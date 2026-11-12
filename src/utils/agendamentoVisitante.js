const {
  assinarCapability,
  assinaturaCorresponde,
} = require(
  "../config/bookingCapability"
);

const CONTEXTO_ACESSO =
  "agenda-fashion:guest-appointment-cancel:v1";

function normalizarAgendamentoId(valor) {
  const id = Number(valor);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function gerarAcessoVisitante(
  agendamentoId
) {
  const id = normalizarAgendamentoId(
    agendamentoId
  );

  if (!id) {
    throw new Error(
      "Agendamento inválido para acesso visitante."
    );
  }

  return assinarCapability({
    contexto:
      CONTEXTO_ACESSO,
    payload:
      String(id),
  });
}

function validarAcessoVisitante(
  agendamentoId,
  acesso
) {
  const id =
    normalizarAgendamentoId(
      agendamentoId
    );

  if (!id) {
    return false;
  }

  return assinaturaCorresponde({
    contexto:
      CONTEXTO_ACESSO,
    payload:
      String(id),
    assinatura:
      acesso,
  });
}

module.exports = {
  gerarAcessoVisitante,
  validarAcessoVisitante,
};
