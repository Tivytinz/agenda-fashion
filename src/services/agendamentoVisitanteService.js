const db = require("../db/db");
const agendaConfiguracaoRepository = require(
  "../repositories/agendaConfiguracaoRepository"
);
const whatsappMensagemService = require(
  "./whatsappMensagemService"
);
const {
  obterDataHoraNoFuso,
} = require("../utils/fusoHorario");
const {
  validarAcessoVisitante,
} = require("../utils/agendamentoVisitante");

const ANTECEDENCIA_CANCELAMENTO_PADRAO = 24;

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

function normalizarHorario(horario) {
  const correspondencia = String(
    horario ?? ""
  ).match(/^(\d{1,2}):(\d{2})/);

  if (!correspondencia) return null;

  const hora = Number(correspondencia[1]);
  const minuto = Number(correspondencia[2]);

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

  return `${String(hora).padStart(2, "0")}:${String(
    minuto
  ).padStart(2, "0")}`;
}

function converterDataHoraParaTimestamp({
  data,
  horario,
}) {
  const horarioNormalizado =
    normalizarHorario(horario);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      String(data || "")
    ) ||
    !horarioNormalizado
  ) {
    return null;
  }

  const timestamp = Date.parse(
    `${data}T${horarioNormalizado}:00Z`
  );

  return Number.isNaN(timestamp)
    ? null
    : timestamp;
}

function validarCancelavel({
  agendamento,
  antecedenciaCancelamento,
}) {
  if (agendamento.status === "cancelado") {
    throw criarErro(
      "Esse agendamento já está cancelado.",
      400
    );
  }

  const agoraLocal = obterDataHoraNoFuso(
    agendamento.fuso_horario
  );
  const timestampAtual =
    converterDataHoraParaTimestamp({
      data: agoraLocal.data,
      horario: agoraLocal.hora,
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

  if (timestampAgendamento <= timestampAtual) {
    throw criarErro(
      "Não é possível cancelar um agendamento já realizado.",
      400
    );
  }

  const numero = Number(
    antecedenciaCancelamento
  );
  const antecedenciaHoras =
    Number.isFinite(numero) && numero >= 0
      ? Math.floor(numero)
      : ANTECEDENCIA_CANCELAMENTO_PADRAO;

  if (antecedenciaHoras === 0) return;

  const limite =
    timestampAgendamento -
    antecedenciaHoras * 60 * 60 * 1000;

  if (timestampAtual > limite) {
    throw criarErro(
      `O prazo para cancelamento encerrou. Este agendamento só pode ser cancelado com pelo menos ${antecedenciaHoras === 1 ? "1 hora" : `${antecedenciaHoras} horas`} de antecedência.`,
      409
    );
  }
}

async function buscarVisitante(
  executor,
  agendamentoId,
  bloquear = false
) {
  const result = await executor.query(
    `
      SELECT
        a.id,
        a.profissional_id,
        a.cliente_id,
        a.status,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS horario,
        COALESCE(
          NULLIF(n.fuso_horario, ''),
          'America/Sao_Paulo'
        ) AS fuso_horario
      FROM agendamentos a
      LEFT JOIN negocios n
        ON n.id = a.negocio_id
      WHERE a.id = $1
        AND a.cliente_id IS NULL
      LIMIT 1
      ${bloquear ? "FOR UPDATE OF a" : ""}
    `,
    [agendamentoId]
  );

  return result.rows[0] || null;
}

async function cancelarAgendamentoVisitante({
  agendamentoId,
  acessoVisitante,
}) {
  const id = normalizarId(agendamentoId);

  if (
    !id ||
    !validarAcessoVisitante(
      id,
      acessoVisitante
    )
  ) {
    throw criarErro(
      "Acesso do agendamento inválido.",
      403
    );
  }

  return db.executarTransacao(
    async (client) => {
      const agendamento =
        await buscarVisitante(
          client,
          id,
          true
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
        await agendaConfiguracaoRepository
          .buscarConfiguracao(
            agendamento.profissional_id
          );

      validarCancelavel({
        agendamento,
        antecedenciaCancelamento:
          configuracao
            ?.antecedencia_cancelamento ??
          ANTECEDENCIA_CANCELAMENTO_PADRAO,
      });

      const result = await client.query(
        `
          UPDATE agendamentos
          SET
            status = 'cancelado',
            cancelado_em = NOW()
          WHERE id = $1
            AND cliente_id IS NULL
            AND status <> 'cancelado'
          RETURNING id, status, cancelado_em
        `,
        [id]
      );

      if (!result.rows[0]) {
        throw criarErro(
          "Não foi possível cancelar o agendamento.",
          409
        );
      }

      await whatsappMensagemService
        .enfileirarCancelamento({
          executor: client,
          agendamentoId: id,
        });

      return {
        mensagem:
          "Agendamento cancelado com sucesso.",
      };
    }
  );
}

module.exports = {
  cancelarAgendamentoVisitante,
};