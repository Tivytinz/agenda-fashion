const crypto = require("crypto");

const CONTEXTO_ACESSO =
  "agenda-fashion:guest-appointment-cancel:v1";

function obterSegredo() {
  const segredo = String(
    process.env.JWT_SECRET || ""
  ).trim();

  if (!segredo) {
    const erro = new Error(
      "JWT_SECRET não configurado."
    );
    erro.status = 500;
    erro.statusCode = 500;
    throw erro;
  }

  return segredo;
}

function normalizarAgendamentoId(valor) {
  const id = Number(valor);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function gerarAcessoVisitante(agendamentoId) {
  const id = normalizarAgendamentoId(
    agendamentoId
  );

  if (!id) {
    throw new Error(
      "Agendamento inválido para acesso visitante."
    );
  }

  return crypto
    .createHmac(
      "sha256",
      obterSegredo()
    )
    .update(`${CONTEXTO_ACESSO}:${id}`)
    .digest("base64url");
}

function validarAcessoVisitante(
  agendamentoId,
  acesso
) {
  if (
    typeof acesso !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(acesso)
  ) {
    return false;
  }

  let esperado;

  try {
    esperado = gerarAcessoVisitante(
      agendamentoId
    );
  } catch {
    return false;
  }

  const recebidoBuffer = Buffer.from(
    acesso,
    "utf8"
  );
  const esperadoBuffer = Buffer.from(
    esperado,
    "utf8"
  );

  return (
    recebidoBuffer.length ===
      esperadoBuffer.length &&
    crypto.timingSafeEqual(
      recebidoBuffer,
      esperadoBuffer
    )
  );
}

module.exports = {
  gerarAcessoVisitante,
  validarAcessoVisitante,
};