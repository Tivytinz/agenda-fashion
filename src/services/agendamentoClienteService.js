const db = require("../db/db");
const agendaPublicaRepository = require(
  "../repositories/agendaPublicaRepository"
);
const agendaConfiguracaoRepository = require(
  "../repositories/agendaConfiguracaoRepository"
);
const whatsappMensagemService = require(
  "./whatsappMensagemService"
);
const { obterDataHoraNoFuso } = require("../utils/fusoHorario");
const {
  ANTECEDENCIA_CANCELAMENTO_PADRAO,
  criarErro,
  normalizarId,
  validarClienteAutenticado,
  converterDataHoraParaTimestamp,
  normalizarAntecedenciaCancelamento,
  formatarQuantidadeHoras,
} = require("./agendamentoPublicoValidacoes");

async function listarMeusAgendamentos({
  clienteId,
}) {
  const id =
    validarClienteAutenticado({
      clienteId,
    });

  const agendamentos =
    await agendaPublicaRepository
      .listarMeusAgendamentos(
        id
      );

  return {
    agendamentos:
      Array.isArray(
        agendamentos
      )
        ? agendamentos
        : [],
  };
}

function validarAgendamentoCancelavel({
  agendamento,
  antecedenciaCancelamento,
}) {
  if (
    agendamento.status ===
    "cancelado"
  ) {
    throw criarErro(
      "Esse agendamento já está cancelado.",
      400
    );
  }

  const agoraLocal =
    obterDataHoraNoFuso(
      agendamento.fuso_horario
    );

  const timestampAtual =
    converterDataHoraParaTimestamp({
      data:
        agoraLocal.data,

      horario:
        agoraLocal.hora,
    });

  const timestampAgendamento =
    converterDataHoraParaTimestamp({
      data:
        agendamento.data,

      horario:
        agendamento.horario,
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
    timestampAgendamento <=
    timestampAtual
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

  if (
    antecedenciaHoras === 0
  ) {
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
  agendamentoId,
}) {
  const id =
    validarClienteAutenticado({
      clienteId,
    });

  const agendamentoIdNormalizado =
    normalizarId(
      agendamentoId
    );

  if (
    !agendamentoIdNormalizado
  ) {
    throw criarErro(
      "Agendamento inválido.",
      400
    );
  }

  const agendamento =
    await agendaPublicaRepository
      .buscarAgendamentoCliente(
        agendamentoIdNormalizado,
        id
      );

  if (!agendamento) {
    throw criarErro(
      "Agendamento não encontrado.",
      404
    );
  }

  if (
    !agendamento.profissional_id ||
    !agendamento.negocio_id
  ) {
    throw criarErro(
      "Contexto do agendamento não encontrado.",
      500
    );
  }

  const configuracao =
    await agendaConfiguracaoRepository
      .buscarConfiguracao(
        agendamento.profissional_id,
        agendamento.negocio_id
      );

  const antecedenciaCancelamento =
    configuracao
      ?.antecedencia_cancelamento ??
    ANTECEDENCIA_CANCELAMENTO_PADRAO;

  validarAgendamentoCancelavel({
    agendamento,
    antecedenciaCancelamento,
  });

  const cancelado =
    await db.executarTransacao(
      async (
        client
      ) => {
        const agendamentoAtual =
          await agendaPublicaRepository
            .buscarAgendamentoCliente(
              agendamentoIdNormalizado,
              id,
              client,
              {
                bloquear: true,
              }
            );

        if (
          !agendamentoAtual
        ) {
          throw criarErro(
            "Agendamento não encontrado.",
            404
          );
        }

        validarAgendamentoCancelavel({
          agendamento:
            agendamentoAtual,

          antecedenciaCancelamento,
        });

        const resultado =
          await agendaPublicaRepository
            .cancelarAgendamento(
              agendamentoIdNormalizado,
              id,
              client
            );

        if (!resultado) {
          throw criarErro(
            "Não foi possível cancelar o agendamento.",
            409
          );
        }

        await whatsappMensagemService
          .enfileirarCancelamento({
            executor:
              client,

            agendamentoId:
              agendamentoIdNormalizado,
          });

        return resultado;
      }
    );

  if (!cancelado) {
    throw criarErro(
      "Não foi possível cancelar o agendamento.",
      409
    );
  }

  return {
    mensagem:
      "Agendamento cancelado com sucesso.",
  };
}

function validarAvaliacao(
  nota
) {
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
    agendamento.status ===
    "cancelado"
  ) {
    throw criarErro(
      "Agendamento cancelado não pode ser avaliado.",
      400
    );
  }

  const agoraLocal =
    obterDataHoraNoFuso(
      agendamento.fuso_horario
    );

  const timestampAtual =
    converterDataHoraParaTimestamp({
      data:
        agoraLocal.data,

      horario:
        agoraLocal.hora,
    });

  const timestampAgendamento =
    converterDataHoraParaTimestamp({
      data:
        agendamento.data,

      horario:
        agendamento.horario,
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
    timestampAgendamento >=
    timestampAtual
  ) {
    throw criarErro(
      "Só é possível avaliar serviços já realizados.",
      400
    );
  }

  if (
    agendamento.avaliacao
  ) {
    throw criarErro(
      "Esse agendamento já foi avaliado.",
      400
    );
  }
}

async function avaliarAgendamento({
  clienteId,
  agendamentoId,
  avaliacao,
}) {
  const id =
    validarClienteAutenticado({
      clienteId,
    });

  const agendamentoIdNormalizado =
    normalizarId(
      agendamentoId
    );

  if (
    !agendamentoIdNormalizado
  ) {
    throw criarErro(
      "Agendamento inválido.",
      400
    );
  }

  const nota =
    Number(
      avaliacao
    );

  validarAvaliacao(
    nota
  );

  const agendamento =
    await agendaPublicaRepository
      .buscarAgendamentoCliente(
        agendamentoIdNormalizado,
        id
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

  const atualizado =
    await agendaPublicaRepository
      .avaliarAgendamento(
        agendamentoIdNormalizado,
        id,
        nota
      );

  if (!atualizado) {
    throw criarErro(
      "Não foi possível salvar a avaliação.",
      409
    );
  }

  return {
    mensagem:
      "Avaliação salva com sucesso.",

    avaliacao:
      nota,
  };
}

module.exports = {
  listarMeusAgendamentos,
  cancelarMeuAgendamento,
  avaliarAgendamento,
};
