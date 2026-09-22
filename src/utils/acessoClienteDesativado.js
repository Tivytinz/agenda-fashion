const crypto = require("crypto");

const CONTEXTO_ACESSO =
  "agenda-fashion:inactive-client-appointment:v1";

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

function gerarAcessoClienteDesativado({
  agendamentoId,
  usuarioId,
  desativadoEm,
}) {
  const agendamento = normalizarId(agendamentoId);
  const usuario = normalizarId(usuarioId);
  const instante = normalizarInstante(desativadoEm);

  if (!agendamento || !usuario || !instante) {
    throw new Error(
      "Dados inválidos para acesso de cliente desativado."
    );
  }

  return crypto
    .createHmac("sha256", obterSegredo())
    .update(
      `${CONTEXTO_ACESSO}:${agendamento}:${usuario}:${instante}`
    )
    .digest("base64url");
}

function validarAcessoClienteDesativado({
  agendamentoId,
  usuarioId,
  desativadoEm,
  acesso,
}) {
  if (
    typeof acesso !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(acesso)
  ) {
    return false;
  }

  let esperado;

  try {
    esperado = gerarAcessoClienteDesativado({
      agendamentoId,
      usuarioId,
      desativadoEm,
    });
  } catch {
    return false;
  }

  const recebido = Buffer.from(acesso, "utf8");
  const esperadoBuffer = Buffer.from(esperado, "utf8");

  return (
    recebido.length === esperadoBuffer.length &&
    crypto.timingSafeEqual(recebido, esperadoBuffer)
  );
}

module.exports = {
  gerarAcessoClienteDesativado,
  validarAcessoClienteDesativado,
};
