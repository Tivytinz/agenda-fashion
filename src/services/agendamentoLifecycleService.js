const db = require("../db/db");
const agendamentoLifecycleRepository = require(
  "../repositories/agendamentoLifecycleRepository"
);
const {
  obterDataHoraNoFuso,
} = require("../utils/fusoHorario");
const bookingAnalyticsService = require(
  "./bookingAnalyticsService"
);

const STATUS_ATIVOS = new Set([
  "agendado",
  "confirmado",
]);

const STATUS_ATENDIMENTO = new Set([
  "iniciado",
  "realizado",
  "falta",
]);

function criarErro(mensagem, statusCode) {
  const erro = new Error(mensagem);
  erro.status = statusCode;
  erro.statusCode = statusCode;
  return erro;
}

function normalizarId(valor) {
  const id = Number(valor);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function normalizarStatus(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase();
}

function converterDataHoraLocalParaTimestamp(data, horario) {
  const dataPartes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    String(data || "")
  );
  const horaPartes = /^(\d{2}):(\d{2})/.exec(
    String(horario || "")
  );

  if (!dataPartes || !horaPartes) {
    return null;
  }

  const ano = Number(dataPartes[1]);
  const mes = Number(dataPartes[2]);
  const dia = Number(dataPartes[3]);
  const hora = Number(horaPartes[1]);
  const minuto = Number(horaPartes[2]);

  if (
    mes < 1 ||
    mes > 12 ||
    dia < 1 ||
    dia > 31 ||
    hora < 0 ||
    hora > 23 ||
    minuto < 0 ||
    minuto > 59
  ) {
    return null;
  }

  return Date.UTC(
    ano,
    mes - 1,
    dia,
    hora,
    minuto,
    0,
    0
  );
}

function validarMomentoInicioAtendimento(agendamento) {
  const agoraLocal = obterDataHoraNoFuso(
    agendamento.fuso_horario
  );

  const agoraTimestamp = converterDataHoraLocalParaTimestamp(
    agoraLocal.data,
    agoraLocal.hora
  );
  const inicioTimestamp = converterDataHoraLocalParaTimestamp(
    agendamento.data,
    agendamento.horario
  );

  if (
    agoraTimestamp === null ||
    inicioTimestamp === null
  ) {
    throw criarErro(
      "Não foi possível validar o horário do atendimento.",
      500
    );
  }

  if (agoraTimestamp < inicioTimestamp) {
    throw criarErro(
      "O atendimento só pode ser iniciado a partir do horário marcado.",
      409
    );
  }
}

function validarMomentoAtendimento(agendamento, statusDestino) {
  const agoraLocal = obterDataHoraNoFuso(
    agendamento.fuso_horario
  );

  const agoraTimestamp = converterDataHoraLocalParaTimestamp(
    agoraLocal.data,
    agoraLocal.hora
  );
  const inicioTimestamp = converterDataHoraLocalParaTimestamp(
    agendamento.data,
    agendamento.horario
  );

  if (
    agoraTimestamp === null ||
    inicioTimestamp === null
  ) {
    throw criarErro(
      "Não foi possível validar o horário do atendimento.",
      500
    );
  }

  if (statusDestino === "falta") {
    const toleranciaNoShowMs = 15 * 60 * 1000;
    const limiteNoShow = inicioTimestamp + toleranciaNoShowMs;

    if (agoraTimestamp < limiteNoShow) {
      throw criarErro(
        "A falta só pode ser registrada após 15 minutos de tolerância.",
        409
      );
    }

    return;
  }

  const duracaoMinutos = Math.max(
    0,
    Number(agendamento.duracao_minutos) || 0
  );
  const fimTimestamp =
    inicioTimestamp + duracaoMinutos * 60 * 1000;

  if (agoraTimestamp < fimTimestamp) {
    throw criarErro(
      "O atendimento só pode ser marcado como realizado depois do horário previsto de término.",
      409
    );
  }
}

async function listarMeusAgendamentos({ clienteId }) {
  const id = normalizarId(clienteId);

  if (!id) {
    throw criarErro(
      "Cliente não autenticado.",
      401
    );
  }

  const agendamentos =
    await agendamentoLifecycleRepository
      .listarAgendamentosCliente(id);

  return { agendamentos };
}

async function avaliarAgendamento({
  clienteId,
  agendamentoId,
  avaliacao,
}) {
  const clienteIdNormalizado = normalizarId(clienteId);
  const agendamentoIdNormalizado = normalizarId(agendamentoId);
  const nota = Number(avaliacao);

  if (!clienteIdNormalizado) {
    throw criarErro(
      "Cliente não autenticado.",
      401
    );
  }

  if (!agendamentoIdNormalizado) {
    throw criarErro(
      "Agendamento inválido.",
      400
    );
  }

  if (
    !Number.isInteger(nota) ||
    nota < 1 ||
    nota > 5
  ) {
    throw criarErro(
      "A avaliação deve ser de 1 a 5 estrelas.",
      400
    );
  }

  const agendamento =
    await agendamentoLifecycleRepository
      .buscarAgendamentoClienteParaAvaliacao(
        agendamentoIdNormalizado,
        clienteIdNormalizado
      );

  if (!agendamento) {
    throw criarErro(
      "Agendamento não encontrado.",
      404
    );
  }

  if (agendamento.status !== "realizado") {
    throw criarErro(
      "Só é possível avaliar um atendimento marcado como realizado.",
      400
    );
  }

  if (agendamento.avaliacao) {
    throw criarErro(
      "Esse agendamento já foi avaliado.",
      400
    );
  }

  const atualizado =
    await agendamentoLifecycleRepository
      .avaliarAgendamentoRealizado(
        agendamentoIdNormalizado,
        clienteIdNormalizado,
        nota
      );

  if (!atualizado) {
    throw criarErro(
      "Não foi possível salvar a avaliação.",
      409
    );
  }

  return {
    mensagem: "Avaliação salva com sucesso.",
    avaliacao: nota,
  };
}

async function atualizarStatusAtendimento({
  usuarioId,
  negocioId,
  agendamentoId,
  status,
}) {
  const usuarioIdNormalizado = normalizarId(usuarioId);
  const negocioIdNormalizado = normalizarId(negocioId);
  const agendamentoIdNormalizado = normalizarId(agendamentoId);
  const statusDestino = normalizarStatus(status);

  if (!usuarioIdNormalizado || !negocioIdNormalizado) {
    throw criarErro(
      "Acesso à agenda não autorizado.",
      403
    );
  }

  if (!agendamentoIdNormalizado) {
    throw criarErro(
      "Agendamento inválido.",
      400
    );
  }

  if (!STATUS_ATENDIMENTO.has(statusDestino)) {
    throw criarErro(
      "Status de atendimento inválido.",
      400
    );
  }

  return db.executarTransacao(async (client) => {
    const agendamento =
      await agendamentoLifecycleRepository
        .buscarAgendamentoOperacionalParaAtualizar({
          agendamentoId: agendamentoIdNormalizado,
          negocioId: negocioIdNormalizado,
          usuarioId: usuarioIdNormalizado,
          executor: client,
        });

    if (!agendamento) {
      throw criarErro(
        "Agendamento não encontrado neste negócio.",
        404
      );
    }

    if (
      agendamento.papel_executor === "profissional" &&
      Number(agendamento.profissional_id) !== usuarioIdNormalizado
    ) {
      throw criarErro(
        "Você só pode atualizar seus próprios atendimentos.",
        403
      );
    }

    if (
      !["dono", "profissional"].includes(
        agendamento.papel_executor
      )
    ) {
      throw criarErro(
        "Seu vínculo não permite atualizar atendimentos.",
        403
      );
    }

    if (
      statusDestino === "realizado" &&
      Number(
        agendamento.profissional_id
      ) !== usuarioIdNormalizado
    ) {
      throw criarErro(
        "Somente a profissional responsável pode concluir este atendimento.",
        403
      );
    }

    if (statusDestino === "iniciado") {
      if (agendamento.atendimento_iniciado_em) {
        return {
          mensagem: "Atendimento já estava iniciado.",
          agendamento: {
            id: agendamentoIdNormalizado,
            status: agendamento.status,
            atendimento_iniciado_em:
              agendamento.atendimento_iniciado_em,
            atendimento_iniciado_por:
              agendamento.atendimento_iniciado_por || null,
          },
        };
      }

      if (!STATUS_ATIVOS.has(agendamento.status)) {
        throw criarErro(
          "Esse agendamento já possui um estado final e não pode ser iniciado.",
          409
        );
      }

      validarMomentoInicioAtendimento(
        agendamento
      );

      const iniciado =
        await agendamentoLifecycleRepository
          .marcarAtendimentoIniciado({
            agendamentoId:
              agendamentoIdNormalizado,
            usuarioId:
              usuarioIdNormalizado,
            executor:
              client,
          });

      if (!iniciado) {
        throw criarErro(
          "O estado do agendamento mudou. Atualize a agenda e tente novamente.",
          409
        );
      }

      return {
        mensagem: "Atendimento iniciado.",
        agendamento: iniciado,
      };
    }

    if (agendamento.status === statusDestino) {
      return {
        mensagem:
          statusDestino === "realizado"
            ? "Atendimento já estava marcado como realizado."
            : "Falta já estava registrada.",
        agendamento: {
          id: agendamentoIdNormalizado,
          status: statusDestino,
          status_atendimento_em:
            agendamento.status_atendimento_em || null,
          status_atendimento_por:
            agendamento.status_atendimento_por || null,
        },
      };
    }

    if (!STATUS_ATIVOS.has(agendamento.status)) {
      throw criarErro(
        "Esse agendamento já possui um estado final e não pode ser alterado por esta ação.",
        409
      );
    }

    if (
      statusDestino === "falta" &&
      agendamento.atendimento_iniciado_em
    ) {
      throw criarErro(
        "Não é possível registrar falta porque o atendimento já foi iniciado.",
        409
      );
    }

    validarMomentoAtendimento(
      agendamento,
      statusDestino
    );

    const atualizado =
      await agendamentoLifecycleRepository
        .atualizarStatusAtendimento({
          agendamentoId: agendamentoIdNormalizado,
          status: statusDestino,
          usuarioId: usuarioIdNormalizado,
          executor: client,
        });

    if (!atualizado) {
      throw criarErro(
        "O estado do agendamento mudou. Atualize a agenda e tente novamente.",
        409
      );
    }

    if (statusDestino === "realizado") {
      await bookingAnalyticsService
        .registrarBookingCompleted({
          agendamentoId:
            agendamentoIdNormalizado,
          actorId:
            usuarioIdNormalizado,
          executor:
            client,
        });
    } else {
      await bookingAnalyticsService
        .registrarBookingNoShow({
          agendamentoId:
            agendamentoIdNormalizado,
          actorType:
            agendamento.papel_executor ===
            "dono"
              ? "OWNER"
              : "PROFESSIONAL",
          actorId:
            usuarioIdNormalizado,
          executor:
            client,
        });
    }

    return {
      mensagem:
        statusDestino === "realizado"
          ? "Atendimento marcado como realizado."
          : "Falta registrada.",
      agendamento: atualizado,
    };
  });
}

module.exports = {
  listarMeusAgendamentos,
  avaliarAgendamento,
  atualizarStatusAtendimento,
  validarMomentoAtendimento,
  validarMomentoInicioAtendimento,
};
