const db = require("../db/db");

const agendaPublicaRepository = require(
  "../repositories/agendaPublicaRepository"
);

const agendaConfiguracaoRepository = require(
  "../repositories/agendaConfiguracaoRepository"
);

const agendaDisponibilidadeService = require(
  "./agendaDisponibilidadeService"
);

const notificationService = require(
  "./notificationService"
);

const ANTECEDENCIA_CANCELAMENTO_PADRAO = 24;

function criarErro(mensagem, statusCode) {
  const erro = new Error(mensagem);

  erro.status = statusCode;
  erro.statusCode = statusCode;

  return erro;
}

function validarClienteAutenticado({
  clienteId,
  tipoUsuario,
}) {
  if (!clienteId) {
    throw criarErro(
      "Cliente não autenticado.",
      401
    );
  }

  if (tipoUsuario !== "cliente") {
    throw criarErro(
      "Apenas clientes podem acessar este recurso.",
      403
    );
  }
}

function normalizarHorario(horario) {
  if (!horario) {
    return null;
  }

  return String(horario).slice(0, 5);
}

function obterDataHoraBrasil() {
  const partes = new Intl.DateTimeFormat(
    "pt-BR",
    {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).formatToParts(new Date());

  const obterParte = (tipo) =>
    partes.find(
      (parte) => parte.type === tipo
    )?.value;

  return {
    data: `${obterParte("year")}-${obterParte(
      "month"
    )}-${obterParte("day")}`,

    hora: `${obterParte("hour")}:${obterParte(
      "minute"
    )}`,
  };
}

function converterDataHoraParaTimestamp({
  data,
  horario,
}) {
  const horarioNormalizado =
    normalizarHorario(horario);

  if (
    !data ||
    !horarioNormalizado
  ) {
    return null;
  }

  /*
   * A data e a hora do Brasil são tratadas
   * como valores nominais em UTC.
   *
   * Isso permite comparar corretamente
   * sem depender do fuso horário do servidor.
   */
  const timestamp = Date.parse(
    `${data}T${horarioNormalizado}:00Z`
  );

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return timestamp;
}

function normalizarAntecedenciaCancelamento(
  valor
) {
  const numero = Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero < 0
  ) {
    return ANTECEDENCIA_CANCELAMENTO_PADRAO;
  }

  return Math.floor(numero);
}

function formatarQuantidadeHoras(
  quantidade
) {
  if (quantidade === 1) {
    return "1 hora";
  }

  return `${quantidade} horas`;
}

async function buscarDadosBaseAgenda({
  slug,
  servicoId,
  profissionalId,
}) {
  if (
    !slug ||
    !servicoId ||
    !profissionalId
  ) {
    throw criarErro(
      "Negócio, serviço e profissional são obrigatórios.",
      400
    );
  }

  const negocio =
    await agendaPublicaRepository.buscarNegocioPorSlug(
      slug
    );

  if (!negocio) {
    throw criarErro(
      "Negócio não encontrado.",
      404
    );
  }

  const servico =
    await agendaPublicaRepository.buscarServicoDoNegocio(
      servicoId,
      negocio.id
    );

  if (!servico) {
    throw criarErro(
      "Serviço não encontrado nesse negócio.",
      404
    );
  }

  const profissional =
    await agendaPublicaRepository.buscarProfissionalDoNegocio(
      profissionalId,
      negocio.id
    );

  if (!profissional) {
    throw criarErro(
      "Profissional não pertence a esse negócio.",
      404
    );
  }

  return {
    negocio,
    servico,
    profissional,
  };
}

async function buscarDisponibilidade({
  profissionalId,
  duracaoServico,
}) {
  if (!profissionalId) {
    throw criarErro(
      "Profissional é obrigatório.",
      400
    );
  }

  return agendaDisponibilidadeService.buscarDisponibilidade({
    profissionalId,
    duracaoServico,
    quantidadeDias: 7,
  });
}

async function obterOuCriarCliente({
  clienteId,
  clienteNome,
  clienteWhatsapp,
}) {
  if (clienteId) {
    return clienteId;
  }

  const nomeNormalizado = String(
    clienteNome || ""
  ).trim();

  const whatsappNormalizado = String(
    clienteWhatsapp || ""
  ).trim();

  if (
    !nomeNormalizado ||
    !whatsappNormalizado
  ) {
    throw criarErro(
      "Nome e WhatsApp do cliente são obrigatórios.",
      400
    );
  }

  const clienteExistente =
    await agendaPublicaRepository.buscarClientePorWhatsapp(
      whatsappNormalizado
    );

  if (clienteExistente) {
    return clienteExistente.id;
  }

  const novoCliente =
    await agendaPublicaRepository.criarCliente(
      nomeNormalizado,
      whatsappNormalizado
    );

  return novoCliente.id;
}

async function validarHorarioDisponivel({
  profissionalId,
  data,
  horario,
  duracaoServico,
}) {
  if (
    !profissionalId ||
    !data ||
    !horario
  ) {
    throw criarErro(
      "Profissional, data e horário são obrigatórios.",
      400
    );
  }

  const disponivel =
    await agendaDisponibilidadeService.horarioEstaDisponivel({
      profissionalId,
      duracaoServico,
      data,
      horario,
      quantidadeDias: 7,
    });

  if (!disponivel) {
    throw criarErro(
      "Esse horário não está mais disponível. Escolha outro horário.",
      409
    );
  }

  return true;
}

async function criarAgendamento({
  data,
  horario,
  profissionalId,
  clienteId,
  servicoId,
  negocioId,
  duracaoServico,
  clienteNome,
  servicoNome,
  profissionalNome,
  whatsappProfissional,
  whatsappNegocio,
}) {
  if (
    !data ||
    !horario ||
    !profissionalId ||
    !clienteId ||
    !servicoId ||
    !negocioId
  ) {
    throw criarErro(
      "Dados do agendamento incompletos.",
      400
    );
  }

  const agendamento =
    await db.executarTransacao(
      async (client) => {
        await agendaPublicaRepository.bloquearAgendaProfissional(
          client,
          profissionalId,
          data
        );

        /*
         * A disponibilidade é recalculada
         * depois do bloqueio transacional.
         */
        const disponivel =
          await agendaDisponibilidadeService.horarioEstaDisponivel({
            profissionalId,
            duracaoServico,
            data,
            horario,
            quantidadeDias: 7,
          });

        if (!disponivel) {
          throw criarErro(
            "Esse horário não está mais disponível. Escolha outro horário.",
            409
          );
        }

        return agendaPublicaRepository.criarAgendamento(
          {
            data,
            horario,
            profissionalId,
            clienteId,
            servicoId,
            negocioId,
          },
          client
        );
      }
    );

  /*
   * A notificação externa só é iniciada
   * depois do COMMIT da transação.
   */
  notificationService
    .novoAgendamento({
      cliente:
        clienteNome ||
        `Cliente #${clienteId}`,

      servico:
        servicoNome ||
        `Serviço #${servicoId}`,

      profissional:
        profissionalNome ||
        `Profissional #${profissionalId}`,

      whatsapp:
        whatsappProfissional ||
        whatsappNegocio,

      data,
      horario,
      negocioId,

      agendamentoId:
        agendamento.id,
    })
    .catch((erro) => {
      console.error(
        "Erro ao enviar notificação de novo agendamento:",
        erro
      );
    });

  return agendamento;
}

async function criarNotificacaoAgendamento({
  usuarioId,
  negocioId,
  agendamentoId,
  titulo,
  mensagem,
}) {
  return agendaPublicaRepository.criarNotificacaoAgendamento({
    usuarioId,
    negocioId,
    agendamentoId,
    titulo,
    mensagem,
  });
}

async function listarMeusAgendamentos({
  clienteId,
  tipoUsuario,
}) {
  validarClienteAutenticado({
    clienteId,
    tipoUsuario,
  });

  const agendamentos =
    await agendaPublicaRepository.listarMeusAgendamentos(
      clienteId
    );

  return {
    agendamentos,
  };
}

function validarAgendamentoCancelavel({
  agendamento,
  antecedenciaCancelamento,
}) {
  if (
    agendamento.status === "cancelado"
  ) {
    throw criarErro(
      "Esse agendamento já está cancelado.",
      400
    );
  }

  const agoraBrasil =
    obterDataHoraBrasil();

  const timestampAtual =
    converterDataHoraParaTimestamp({
      data: agoraBrasil.data,
      horario: agoraBrasil.hora,
    });

  const timestampAgendamento =
    converterDataHoraParaTimestamp({
      data: agendamento.data,
      horario: agendamento.horario,
    });

  if (
    timestampAtual === null ||
    timestampAgendamento === null
  ) {
    throw criarErro(
      "Não foi possível validar a data e o horário do agendamento.",
      500
    );
  }

  if (
    timestampAgendamento <= timestampAtual
  ) {
    throw criarErro(
      "Não é possível cancelar um agendamento já realizado.",
      400
    );
  }

  const antecedenciaHoras =
    normalizarAntecedenciaCancelamento(
      antecedenciaCancelamento
    );

  if (antecedenciaHoras === 0) {
    return true;
  }

  const limiteCancelamento =
    timestampAgendamento -
    antecedenciaHoras *
      60 *
      60 *
      1000;

  if (
    timestampAtual >
    limiteCancelamento
  ) {
    throw criarErro(
      `O prazo para cancelamento encerrou. ` +
        `Este agendamento só pode ser cancelado com pelo menos ` +
        `${formatarQuantidadeHoras(
          antecedenciaHoras
        )} de antecedência.`,
      409
    );
  }

  return true;
}

async function cancelarMeuAgendamento({
  clienteId,
  tipoUsuario,
  agendamentoId,
}) {
  validarClienteAutenticado({
    clienteId,
    tipoUsuario,
  });

  const agendamento =
    await agendaPublicaRepository.buscarAgendamentoCliente(
      agendamentoId,
      clienteId
    );

  if (!agendamento) {
    throw criarErro(
      "Agendamento não encontrado.",
      404
    );
  }

  if (!agendamento.profissional_id) {
    throw criarErro(
      "Profissional do agendamento não encontrado.",
      500
    );
  }

  const configuracao =
    await agendaConfiguracaoRepository.buscarConfiguracao(
      agendamento.profissional_id
    );

  const antecedenciaCancelamento =
    configuracao
      ?.antecedencia_cancelamento ??
    ANTECEDENCIA_CANCELAMENTO_PADRAO;

  validarAgendamentoCancelavel({
    agendamento,
    antecedenciaCancelamento,
  });

  await agendaPublicaRepository.cancelarAgendamento(
    agendamentoId,
    clienteId
  );

  return {
    mensagem:
      "Agendamento cancelado com sucesso.",
  };
}

function validarAvaliacao(nota) {
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
}

function validarAgendamentoAvaliavel(
  agendamento
) {
  if (
    agendamento.status === "cancelado"
  ) {
    throw criarErro(
      "Agendamento cancelado não pode ser avaliado.",
      400
    );
  }

  const dataAgendamento = new Date(
    `${agendamento.data}T00:00:00`
  );

  const hoje = new Date();

  hoje.setHours(
    hoje.getHours() - 3
  );

  hoje.setHours(
    0,
    0,
    0,
    0
  );

  if (dataAgendamento >= hoje) {
    throw criarErro(
      "Só é possível avaliar serviços já realizados.",
      400
    );
  }

  if (agendamento.avaliacao) {
    throw criarErro(
      "Esse agendamento já foi avaliado.",
      400
    );
  }
}

async function avaliarAgendamento({
  clienteId,
  tipoUsuario,
  agendamentoId,
  avaliacao,
}) {
  validarClienteAutenticado({
    clienteId,
    tipoUsuario,
  });

  const nota = Number(
    avaliacao
  );

  validarAvaliacao(
    nota
  );

  const agendamento =
    await agendaPublicaRepository.buscarAgendamentoCliente(
      agendamentoId,
      clienteId
    );

  if (!agendamento) {
    throw criarErro(
      "Agendamento não encontrado.",
      404
    );
  }

  validarAgendamentoAvaliavel(
    agendamento
  );

  await agendaPublicaRepository.avaliarAgendamento(
    agendamentoId,
    clienteId,
    nota
  );

  return {
    mensagem:
      "Avaliação salva com sucesso.",

    avaliacao: nota,
  };
}

module.exports = {
  buscarDadosBaseAgenda,
  buscarDisponibilidade,
  obterOuCriarCliente,
  validarHorarioDisponivel,
  criarAgendamento,
  criarNotificacaoAgendamento,
  listarMeusAgendamentos,
  cancelarMeuAgendamento,
  avaliarAgendamento,
};