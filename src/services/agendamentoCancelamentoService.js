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

const ANTECEDENCIA_CANCELAMENTO_PADRAO = 2;
const STATUS_CANCELAVEIS_OPERACIONAL = new Set([
  "agendado",
  "confirmado",
]);
const PAPEIS_CANCELAMENTO_OPERACIONAL = new Set([
  "dono",
  "profissional",
]);

const MOTIVOS_CANCELAMENTO_OPERACIONAL = new Map([
  ["profissional_indisponivel", "Profissional indisponível"],
  ["estabelecimento_indisponivel", "Estabelecimento indisponível"],
  ["atendimento_interrompido", "Atendimento interrompido antes da conclusão"],
  ["cliente_ausente", "Cliente ausente"],
  ["outro", "Outro motivo"],
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

function normalizarMotivoCancelamento(valor) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  if (typeof valor !== "string") {
    throw criarErro(
      "Motivo do cancelamento inválido.",
      400
    );
  }

  const motivo = valor.trim();

  if (!motivo) {
    return null;
  }

  if (motivo.length > 300) {
    throw criarErro(
      "O motivo do cancelamento deve ter no máximo 300 caracteres.",
      400
    );
  }

  return motivo;
}

function normalizarTipoMotivoCancelamento(valor) {
  const tipo = String(valor || "")
    .trim()
    .toLowerCase();

  if (!MOTIVOS_CANCELAMENTO_OPERACIONAL.has(tipo)) {
    throw criarErro(
      "Selecione um motivo válido para o cancelamento.",
      400
    );
  }

  return tipo;
}

function montarMotivoCancelamentoOperacional({
  motivoTipo,
  motivo,
}) {
  const tipo = normalizarTipoMotivoCancelamento(
    motivoTipo
  );
  const detalhe = normalizarMotivoCancelamento(
    motivo
  );

  if (tipo === "outro" && !detalhe) {
    throw criarErro(
      "Descreva o motivo do cancelamento.",
      400
    );
  }

  if (tipo === "outro") {
    return detalhe;
  }

  const rotulo =
    MOTIVOS_CANCELAMENTO_OPERACIONAL.get(tipo);

  const motivoFinal = detalhe
    ? `${rotulo}: ${detalhe}`
    : rotulo;

  if (motivoFinal.length > 300) {
    throw criarErro(
      "O motivo do cancelamento deve ter no máximo 300 caracteres.",
      400
    );
  }

  return motivoFinal;
}

function validarMotivoCancelamentoOperacional({
  agendamento,
  motivoTipo,
}) {
  if (motivoTipo !== "cliente_ausente") {
    return true;
  }

  const agoraLocal = obterDataHoraNoFuso(
    agendamento.fuso_horario
  );
  const inicio = converterDataHoraParaTimestamp({
    data: agendamento.data,
    horario: agendamento.horario,
  });
  const agora = converterDataHoraParaTimestamp({
    data: agoraLocal.data,
    horario: agoraLocal.hora,
  });

  if (inicio === null || agora === null) {
    throw criarErro(
      "Não foi possível validar a tolerância de ausência do cliente.",
      500
    );
  }

  const limiteNoShow =
    inicio + 15 * 60 * 1000;

  if (agora < limiteNoShow) {
    throw criarErro(
      "A ausência do cliente não autoriza cancelamento durante a tolerância de 15 minutos.",
      409
    );
  }

  throw criarErro(
    "Após 15 minutos de ausência, registre NAO_COMPARECEU usando a ação Marcar falta.",
    409
  );
}

function formatarQuantidadeHoras(quantidade) {
  return quantidade === 1
    ? "1 hora"
    : `${quantidade} horas`;
}

function validarDataHoraFutura({
  agendamento,
  mensagemPassado,
  statusCodePassado = 409,
}) {
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
      "Não foi possível validar a data e o horário do agendamento.",
      500
    );
  }

  if (inicioAgendamento <= agora) {
    throw criarErro(
      mensagemPassado,
      statusCodePassado
    );
  }

  return {
    inicioAgendamento,
    agora,
  };
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

  const tempos = validarDataHoraFutura({
    agendamento,
    mensagemPassado:
      "Não é possível cancelar um agendamento já realizado.",
    statusCodePassado: 400,
  });

  const antecedenciaHoras = normalizarAntecedenciaCancelamento(
    agendamento.antecedencia_cancelamento_horas
  );

  if (antecedenciaHoras === 0) {
    return true;
  }

  const limiteCancelamento =
    tempos.inicioAgendamento - antecedenciaHoras * 60 * 60 * 1000;

  if (tempos.agora > limiteCancelamento) {
    throw criarErro(
      `O prazo para cancelamento encerrou. ` +
      `Este agendamento só pode ser cancelado com pelo menos ` +
      `${formatarQuantidadeHoras(antecedenciaHoras)} de antecedência.`,
      409
    );
  }

  return true;
}

function validarAgendamentoCancelavelOperacional({
  agendamento,
  usuarioId,
}) {
  if (!agendamento) {
    throw criarErro(
      "Agendamento não encontrado.",
      404
    );
  }

  const papel = String(
    agendamento.papel_executor || ""
  ).trim().toLowerCase();

  if (!PAPEIS_CANCELAMENTO_OPERACIONAL.has(papel)) {
    throw criarErro(
      "Você não tem permissão para cancelar este agendamento.",
      403
    );
  }

  if (
    papel === "profissional" &&
    Number(agendamento.profissional_id) !== Number(usuarioId)
  ) {
    throw criarErro(
      "Você só pode cancelar seus próprios agendamentos.",
      403
    );
  }

  if (agendamento.status === "cancelado") {
    return {
      jaCancelado: true,
    };
  }

  if (!STATUS_CANCELAVEIS_OPERACIONAL.has(agendamento.status)) {
    throw criarErro(
      "Este atendimento não pode mais ser cancelado.",
      409
    );
  }

  return {
    jaCancelado: false,
  };
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
        "Não foi possível cancelar o agendamento.",
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

async function consultarAgendamentoVisitante({
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

  const agendamento =
    await agendamentoCancelamentoRepository
      .buscarAgendamentoVisitanteParaConsultar({
        agendamentoId: id,
      });

  if (!agendamento) {
    throw criarErro(
      "Agendamento visitante não encontrado.",
      404
    );
  }

  let podeCancelar = false;
  let cancelamentoIndisponivel = null;

  try {
    validarAgendamentoCancelavel(agendamento);
    podeCancelar = true;
  } catch (erro) {
    cancelamentoIndisponivel =
      erro?.message ||
      "Este agendamento não pode mais ser cancelado.";
  }

  return {
    agendamento: {
      id: Number(agendamento.id),
      status: agendamento.status,
      data: agendamento.data,
      horario: agendamento.horario,
      servico_nome: agendamento.servico_nome,
      profissional_nome: agendamento.profissional_nome,
      negocio_nome: agendamento.negocio_nome,
      valor: agendamento.valor,
      antecedencia_cancelamento_horas:
        agendamento.antecedencia_cancelamento_horas,
    },
    pode_cancelar: podeCancelar,
    cancelamento_indisponivel:
      cancelamentoIndisponivel,
  };
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
        "Não foi possível cancelar o agendamento.",
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

async function cancelarAgendamentoOperacional({
  agendamentoId,
  negocioId,
  usuarioId,
  motivoTipo,
  motivo,
}) {
  const id = normalizarId(agendamentoId);
  const negocio = normalizarId(negocioId);
  const usuario = normalizarId(usuarioId);

  if (!id || !negocio || !usuario) {
    throw criarErro(
      "Agendamento não encontrado.",
      404
    );
  }

  const motivoEntrada =
    normalizarMotivoCancelamento(
      motivo
    );

  return db.executarTransacao(async (client) => {
    const agendamento =
      await agendamentoCancelamentoRepository
        .buscarAgendamentoOperacionalParaCancelar({
          agendamentoId: id,
          negocioId: negocio,
          usuarioId: usuario,
          executor: client,
        });

    const validacao = validarAgendamentoCancelavelOperacional({
      agendamento,
      usuarioId: usuario,
    });

    if (validacao.jaCancelado) {
      return {
        ja_cancelado: true,
        agendamento: {
          id: agendamento.id,
          status: agendamento.status,
          cancelado_em: agendamento.cancelado_em,
          cancelado_por: agendamento.cancelado_por,
          cancelamento_origem: agendamento.cancelamento_origem,
          motivo_cancelamento: agendamento.motivo_cancelamento,
        },
      };
    }

    const motivoTipoNormalizado =
      normalizarTipoMotivoCancelamento(
        motivoTipo
      );

    validarMotivoCancelamentoOperacional({
      agendamento,
      motivoTipo: motivoTipoNormalizado,
    });

    const motivoNormalizado =
      montarMotivoCancelamentoOperacional({
        motivoTipo: motivoTipoNormalizado,
        motivo: motivoEntrada,
      });

    const cancelado =
      await agendamentoCancelamentoRepository
        .cancelarAgendamentoOperacional({
          agendamentoId: id,
          usuarioId: usuario,
          motivo: motivoNormalizado,
          executor: client,
        });

    if (!cancelado) {
      throw criarErro(
        "O agendamento mudou enquanto o cancelamento era processado. Atualize a agenda e tente novamente.",
        409
      );
    }

    await whatsappMensagemService.enfileirarCancelamento({
      executor: client,
      agendamentoId: id,
    });

    return {
      ja_cancelado: false,
      agendamento: cancelado,
    };
  });
}

module.exports = {
  ANTECEDENCIA_CANCELAMENTO_PADRAO,
  normalizarAntecedenciaCancelamento,
  normalizarMotivoCancelamento,
  normalizarTipoMotivoCancelamento,
  montarMotivoCancelamentoOperacional,
  validarMotivoCancelamentoOperacional,
  validarAgendamentoCancelavel,
  validarAgendamentoCancelavelOperacional,
  buscarPoliticaPublica,
  validarPoliticaEsperada,
  cancelarAgendamentoCliente,
  consultarAgendamentoVisitante,
  cancelarAgendamentoVisitante,
  cancelarAgendamentoOperacional,
};
