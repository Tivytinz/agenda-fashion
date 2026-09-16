const db = require("../db/db");
const agendamentoCancelamentoRepository = require(
  "../repositories/agendamentoCancelamentoRepository"
);
const whatsappMensagemService = require(
  "./whatsappMensagemService"
);
const {
  validarAcessoVisitante,
} = require("../utils/agendamentoVisitante");
const {
  obterDataHoraNoFuso,
} = require("../utils/fusoHorario");

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

function normalizarSlug(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .slice(0, 180);
}

function normalizarHorario(horario) {
  const valor = String(horario || "").trim();
  const correspondencia = valor.match(/^(\d{1,2}):(\d{2})/);

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

  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

function converterDataHoraParaTimestamp({
  data,
  horario,
}) {
  const horarioNormalizado = normalizarHorario(horario);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(String(data || "")) ||
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

function normalizarAntecedenciaCancelamento(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero < 0) {
    return ANTECEDENCIA_CANCELAMENTO_PADRAO;
  }

  return Math.floor(numero);
}

function formatarQuantidadeHoras(quantidade) {
  return quantidade === 1
    ? "1 hora"
    : `${quantidade} horas`;
}

function validarAgendamentoCancelavel(agendamento) {
  if (!agendamento) {
    throw criarErro(
      "Agendamento não encontrado.",
      404
    );
  }

  if (agendamento.status === "cancelado") {
    throw criarErro(
      "Esse agendamento já está cancelado.",
      400
    );
  }

  const agoraLocal = obterDataHoraNoFuso(
    agendamento.fuso_horario
  );
  const inicioAgendamento = converterDataHoraParaTimestamp({
    data: agendamento.data,
    horario: agendamento.horario,
  });
  const agora = converterDataHoraParaTimestamp({
    data: agoraLocal.data,
    horario: agoraLocal.hora,
  });

  if (
    inicioAgendamento === null ||
    agora === null
  ) {
    throw criarErro(
      "Não foi possível validar o horário desse agendamento.",
      500
    );
  }

  if (inicioAgendamento <= agora) {
    throw criarErro(
      "Não é possível cancelar um agendamento que já ocorreu.",
      400
    );
  }

  const antecedenciaHoras = normalizarAntecedenciaCancelamento(
    agendamento.antecedencia_cancelamento_horas
  );

  if (antecedenciaHoras === 0) {
    return true;
  }

  const limiteCancelamento =
    inicioAgendamento - antecedenciaHoras * 60 * 60 * 1000;

  if (agora > limiteCancelamento) {
    throw criarErro(
      `O cancelamento precisa ser feito com pelo menos ${formatarQuantidadeHoras(antecedenciaHoras)} antes do horário agendado.`,
      409
    );
  }

  return true;
}

async function buscarPoliticaPublica({
  slug,
  profissionalId,
}) {
  const slugNormalizado = normalizarSlug(slug);
  const profissionalIdNormalizado = normalizarId(profissionalId);

  if (!slugNormalizado || !profissionalIdNormalizado) {
    throw criarErro(
      "Negócio e profissional são obrigatórios.",
      400
    );
  }

  const politica =
    await agendamentoCancelamentoRepository.buscarPoliticaPublica({
      slug: slugNormalizado,
      profissionalId: profissionalIdNormalizado,
    });

  if (!politica) {
    throw criarErro(
      "Profissional não encontrado nesse negócio.",
      404
    );
  }

  return {
    antecedencia_horas: normalizarAntecedenciaCancelamento(
      politica.antecedencia_cancelamento_horas
    ),
  };
}

async function validarPoliticaEsperada({
  slug,
  profissionalId,
  antecedenciaEsperada,
}) {
  if (
    antecedenciaEsperada === undefined ||
    antecedenciaEsperada === null ||
    antecedenciaEsperada === ""
  ) {
    return null;
  }

  const esperada = Number(antecedenciaEsperada);

  if (
    !Number.isInteger(esperada) ||
    esperada < 0
  ) {
    throw criarErro(
      "Política de cancelamento inválida.",
      400
    );
  }

  const atual = await buscarPoliticaPublica({
    slug,
    profissionalId,
  });

  if (atual.antecedencia_horas !== esperada) {
    throw criarErro(
      "A política de cancelamento foi atualizada. Revise as condições antes de confirmar o agendamento.",
      409
    );
  }

  return atual;
}

async function cancelarAgendamentoCliente({
  agendamentoId,
  clienteId,
}) {
  const id = normalizarId(agendamentoId);
  const usuarioId = normalizarId(clienteId);

  if (!id || !usuarioId) {
    throw criarErro(
      "Agendamento não encontrado.",
      404
    );
  }

  return db.executarTransacao(async (client) => {
    const agendamento =
      await agendamentoCancelamentoRepository
        .buscarAgendamentoClienteParaCancelar({
          agendamentoId: id,
          clienteId: usuarioId,
          executor: client,
        });

    validarAgendamentoCancelavel(agendamento);

    const cancelado =
      await agendamentoCancelamentoRepository
        .cancelarAgendamentoCliente({
          agendamentoId: id,
          clienteId: usuarioId,
          executor: client,
        });

    if (!cancelado) {
      throw criarErro(
        "Não foi possível cancelar esse agendamento.",
        409
      );
    }

    await whatsappMensagemService.enfileirarCancelamento({
      executor: client,
      agendamentoId: id,
    });

    return cancelado;
  });
}

async function cancelarAgendamentoVisitante({
  agendamentoId,
  acessoVisitante,
}) {
  const id = normalizarId(agendamentoId);

  if (
    !id ||
    !validarAcessoVisitante(id, acessoVisitante)
  ) {
    throw criarErro(
      "Acesso do agendamento inválido.",
      403
    );
  }

  return db.executarTransacao(async (client) => {
    const agendamento =
      await agendamentoCancelamentoRepository
        .buscarAgendamentoVisitanteParaCancelar({
          agendamentoId: id,
          executor: client,
        });

    validarAgendamentoCancelavel(agendamento);

    const cancelado =
      await agendamentoCancelamentoRepository
        .cancelarAgendamentoVisitante({
          agendamentoId: id,
          executor: client,
        });

    if (!cancelado) {
      throw criarErro(
        "Não foi possível cancelar esse agendamento.",
        409
      );
    }

    await whatsappMensagemService.enfileirarCancelamento({
      executor: client,
      agendamentoId: id,
    });

    return cancelado;
  });
}

module.exports = {
  ANTECEDENCIA_CANCELAMENTO_PADRAO,
  normalizarAntecedenciaCancelamento,
  validarAgendamentoCancelavel,
  buscarPoliticaPublica,
  validarPoliticaEsperada,
  cancelarAgendamentoCliente,
  cancelarAgendamentoVisitante,
};
