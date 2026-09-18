const db = require("../db/db");
const agendamentoReagendamentoRepository = require(
  "../repositories/agendamentoReagendamentoRepository"
);
const agendaPublicaRepository = require(
  "../repositories/agendaPublicaRepository"
);
const agendaDisponibilidadeService = require(
  "./agendaDisponibilidadeService"
);
const {
  obterDataHoraNoFuso,
} = require("../utils/fusoHorario");

const STATUS_ATIVOS = new Set([
  "agendado",
  "confirmado",
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

function normalizarData(valor) {
  const data = String(valor || "").trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(data)
    ? data
    : null;
}

function normalizarHorario(valor) {
  const texto = String(valor || "").trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(texto);

  if (!match) return null;

  const hora = Number(match[1]);
  const minuto = Number(match[2]);

  if (
    !Number.isInteger(hora) ||
    !Number.isInteger(minuto) ||
    hora < 0 ||
    hora > 23 ||
    minuto < 0 ||
    minuto > 59
  ) {
    return null;
  }

  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

function converterDataHoraLocalParaTimestamp(data, horario) {
  const dataNormalizada = normalizarData(data);
  const horarioNormalizado = normalizarHorario(horario);

  if (!dataNormalizada || !horarioNormalizado) {
    return null;
  }

  const timestamp = Date.parse(
    `${dataNormalizada}T${horarioNormalizado}:00Z`
  );

  return Number.isNaN(timestamp)
    ? null
    : timestamp;
}

function obterAgoraLocal(fusoHorario) {
  const local = obterDataHoraNoFuso(
    fusoHorario
  );

  return {
    ...local,
    timestamp:
      converterDataHoraLocalParaTimestamp(
        local.data,
        local.hora
      ),
  };
}

function calcularQuantidadeDiasAte({
  data,
  agoraData,
}) {
  const alvo = Date.parse(
    `${data}T12:00:00Z`
  );
  const base = Date.parse(
    `${agoraData}T12:00:00Z`
  );

  if (
    Number.isNaN(alvo) ||
    Number.isNaN(base)
  ) {
    return 1;
  }

  return Math.max(
    1,
    Math.ceil(
      (alvo - base) /
        (24 * 60 * 60 * 1000)
    ) + 1
  );
}

function normalizarAntecedencia(valor) {
  const numero = Number(valor);

  if (
    !Number.isInteger(numero) ||
    numero < 0 ||
    numero > 168
  ) {
    return 2;
  }

  return numero;
}

function calcularPoliticaCancelamento({
  data,
  horario,
  antecedenciaHoras,
  agoraTimestamp,
}) {
  const inicio =
    converterDataHoraLocalParaTimestamp(
      data,
      horario
    );

  if (
    inicio === null ||
    agoraTimestamp === null
  ) {
    return {
      cancelamento_direto_disponivel: false,
      cancelamento_limite: null,
    };
  }

  const limite =
    inicio -
    antecedenciaHoras *
      60 *
      60 *
      1000;

  return {
    cancelamento_direto_disponivel:
      agoraTimestamp <= limite,
    cancelamento_limite:
      new Date(limite)
        .toISOString(),
  };
}

async function reagendarOperacional({
  usuarioId,
  negocioId,
  agendamentoId,
  data,
  horario,
  profissionalId,
}) {
  const usuario =
    normalizarId(usuarioId);
  const negocio =
    normalizarId(negocioId);
  const agendamento =
    normalizarId(agendamentoId);
  const novaData =
    normalizarData(data);
  const novoHorario =
    normalizarHorario(horario);
  const profissionalSolicitado =
    profissionalId === undefined ||
    profissionalId === null ||
    profissionalId === ""
      ? null
      : normalizarId(profissionalId);

  if (!usuario || !negocio) {
    throw criarErro(
      "Acesso à agenda não autorizado.",
      403
    );
  }

  if (!agendamento) {
    throw criarErro(
      "Agendamento inválido.",
      400
    );
  }

  if (!novaData || !novoHorario) {
    throw criarErro(
      "Nova data e horário são obrigatórios.",
      400
    );
  }

  if (
    profissionalId !== undefined &&
    profissionalId !== null &&
    profissionalId !== "" &&
    !profissionalSolicitado
  ) {
    throw criarErro(
      "Profissional de destino inválido.",
      400
    );
  }

  return db.executarTransacao(
    async (client) => {
      const atual =
        await agendamentoReagendamentoRepository
          .buscarAgendamentoParaReagendar({
            agendamentoId:
              agendamento,
            negocioId:
              negocio,
            usuarioId:
              usuario,
            executor:
              client,
          });

      if (!atual) {
        throw criarErro(
          "Agendamento não encontrado neste negócio.",
          404
        );
      }

      const papel =
        String(
          atual.papel_executor ||
          ""
        )
          .trim()
          .toLowerCase();

      if (
        !["dono", "profissional"]
          .includes(papel)
      ) {
        throw criarErro(
          "Seu vínculo não permite reagendar este agendamento.",
          403
        );
      }

      if (
        !STATUS_ATIVOS.has(
          String(atual.status)
            .toLowerCase()
        )
      ) {
        throw criarErro(
          "Esse agendamento já possui um estado final e não pode ser reagendado.",
          409
        );
      }

      if (
        papel === "profissional" &&
        Number(atual.profissional_id) !==
          usuario
      ) {
        throw criarErro(
          "Você só pode reagendar seus próprios agendamentos.",
          403
        );
      }

      const profissionalAtual =
        Number(
          atual.profissional_id
        );

      const profissionalDestino =
        profissionalSolicitado ||
        profissionalAtual;

      if (
        papel === "profissional" &&
        profissionalDestino !==
          profissionalAtual
      ) {
        throw criarErro(
          "A profissional responsável não pode transferir o agendamento para outra profissional.",
          403
        );
      }

      if (
        papel === "dono" &&
        profissionalDestino !==
          profissionalAtual
      ) {
        throw criarErro(
          "A troca de responsável será habilitada quando a elegibilidade profissional-serviço estiver configurada.",
          409
        );
      }

      const destino =
        await agendamentoReagendamentoRepository
          .buscarProfissionalAtivoNoNegocio({
            profissionalId:
              profissionalDestino,
            negocioId:
              negocio,
            executor:
              client,
          });

      if (!destino) {
        throw criarErro(
          "A profissional de destino não está ativa neste negócio.",
          409
        );
      }

      const agora =
        obterAgoraLocal(
          atual.fuso_horario
        );

      const novoInicio =
        converterDataHoraLocalParaTimestamp(
          novaData,
          novoHorario
        );

      if (
        agora.timestamp === null ||
        novoInicio === null
      ) {
        throw criarErro(
          "Não foi possível validar o novo horário.",
          500
        );
      }

      if (
        novoInicio <=
        agora.timestamp
      ) {
        throw criarErro(
          "O novo início do agendamento deve estar no futuro.",
          409
        );
      }

      const inicioAnterior =
        converterDataHoraLocalParaTimestamp(
          atual.data,
          atual.horario
        );

      if (
        inicioAnterior !== null &&
        inicioAnterior <=
          agora.timestamp &&
        atual.atendimento_iniciado_em
      ) {
        throw criarErro(
          "O atendimento já começou e não pode mais ser reagendado.",
          409
        );
      }

      if (
        profissionalDestino ===
          Number(
            atual.profissional_id
          ) &&
        novaData ===
          String(atual.data) &&
        novoHorario ===
          normalizarHorario(
            atual.horario
          )
      ) {
        throw criarErro(
          "Escolha um novo horário ou profissional para reagendar.",
          400
        );
      }

      await agendaPublicaRepository
        .bloquearAgendaProfissional(
          client,
          profissionalDestino,
          novaData
        );

      const quantidadeDias =
        calcularQuantidadeDiasAte({
          data:
            novaData,
          agoraData:
            agora.data,
        });

      const disponivel =
        await agendaDisponibilidadeService
          .horarioEstaDisponivel({
            profissionalId:
              profissionalDestino,
            negocioId:
              negocio,
            duracaoServico:
              Number(
                atual.duracao_minutos
              ) || 60,
            data:
              novaData,
            horario:
              novoHorario,
            quantidadeDias,
            fusoHorario:
              atual.fuso_horario,
            agendamentoIgnorarId:
              agendamento,
            ignorarAntecedencia:
              true,
          });

      if (!disponivel) {
        throw criarErro(
          "O novo horário não está disponível para essa profissional.",
          409
        );
      }

      const antecedencia =
        normalizarAntecedencia(
          atual
            .antecedencia_cancelamento_horas
        );

      const atualizado =
        await agendamentoReagendamentoRepository
          .atualizarReagendamento({
            agendamentoId:
              agendamento,
            profissionalId:
              profissionalDestino,
            data:
              novaData,
            horario:
              novoHorario,
            executor:
              client,
          });

      if (!atualizado) {
        throw criarErro(
          "O agendamento mudou enquanto o reagendamento era processado. Atualize a agenda e tente novamente.",
          409
        );
      }

      const historico =
        await agendamentoReagendamentoRepository
          .registrarHistoricoReagendamento({
            agendamentoId:
              agendamento,
            negocioId:
              negocio,
            actorUserId:
              usuario,
            actorType:
              papel === "dono"
                ? "OWNER"
                : "PROFESSIONAL",
            previousProfissionalId:
              Number(
                atual.profissional_id
              ),
            newProfissionalId:
              profissionalDestino,
            previousData:
              atual.data,
            previousHorario:
              atual.horario,
            newData:
              novaData,
            newHorario:
              novoHorario,
            antecedenciaCancelamentoHoras:
              antecedencia,
            executor:
              client,
          });

      if (!historico?.id) {
        throw criarErro(
          "Não foi possível registrar o histórico do reagendamento.",
          500
        );
      }

      const politica =
        calcularPoliticaCancelamento({
          data:
            novaData,
          horario:
            novoHorario,
          antecedenciaHoras:
            antecedencia,
          agoraTimestamp:
            agora.timestamp,
        });

      return {
        mensagem:
          politica
            .cancelamento_direto_disponivel
            ? "Agendamento reagendado com sucesso."
            : "Agendamento reagendado. O cancelamento direto pelo AF não está disponível para esta reserva.",
        agendamento:
          atualizado,
        reagendamento: {
          id:
            historico.id,
          previous_profissional_id:
            Number(
              atual.profissional_id
            ),
          professional_id:
            profissionalDestino,
          previous_scheduled_start_at:
            `${atual.data}T${normalizarHorario(
              atual.horario
            )}:00`,
          scheduled_start_at:
            `${novaData}T${novoHorario}:00`,
          actor_type:
            papel === "dono"
              ? "OWNER"
              : "PROFESSIONAL",
          actor_id:
            usuario,
          cancelamento_direto_disponivel:
            politica
              .cancelamento_direto_disponivel,
          cancelamento_limite:
            politica
              .cancelamento_limite,
        },
      };
    }
  );
}

module.exports = {
  reagendarOperacional,
  calcularPoliticaCancelamento,
  converterDataHoraLocalParaTimestamp,
};
