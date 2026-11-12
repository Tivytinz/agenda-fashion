const {
  assinarCapability,
  assinaturaCorresponde,
} = require(
  "../config/bookingCapability"
);

const CONTEXTO_ACESSO =
  "agenda-fashion:inactive-client-appointment:v1";

function normalizarId(valor) {
  const id = Number(valor);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function normalizarInstante(valor) {
  const data = valor instanceof Date
    ? valor
    : new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  return data.toISOString();
}

function payloadAcesso({
  agendamentoId,
  usuarioId,
  desativadoEm,
}) {
  const agendamento =
    normalizarId(
      agendamentoId
    );
  const usuario =
    normalizarId(
      usuarioId
    );
  const instante =
    normalizarInstante(
      desativadoEm
    );

  if (!agendamento || !usuario || !instante) {
    return null;
  }

  return `${agendamento}:${usuario}:${instante}`;
}

function gerarAcessoClienteDesativado({
  agendamentoId,
  usuarioId,
  desativadoEm,
}) {
  const payload =
    payloadAcesso({
      agendamentoId,
      usuarioId,
      desativadoEm,
    });

  if (!payload) {
    throw new Error(
      "Dados inválidos para acesso de cliente desativado."
    );
  }

  return assinarCapability({
    contexto:
      CONTEXTO_ACESSO,
    payload,
  });
}

function validarAcessoClienteDesativado({
  agendamentoId,
  usuarioId,
  desativadoEm,
  acesso,
}) {
  const payload =
    payloadAcesso({
      agendamentoId,
      usuarioId,
      desativadoEm,
    });

  if (!payload) {
    return false;
  }

  return assinaturaCorresponde({
    contexto:
      CONTEXTO_ACESSO,
    payload,
    assinatura:
      acesso,
  });
}

module.exports = {
  gerarAcessoClienteDesativado,
  validarAcessoClienteDesativado,
};
