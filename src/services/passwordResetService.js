const crypto = require("crypto");
const bcrypt = require("bcrypt");
const authRepository = require("../repositories/authRepository");
const passwordResetRepository = require("../repositories/passwordResetRepository");
const emailProvider = require("../providers/emailProvider");
const registrador = require("../utils/registrador");
const AppError = require("../errors/AppError");

const RESPOSTA_NEUTRA =
  "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.";
const DURACAO_TOKEN_MS = 30 * 60 * 1000;

function normalizarEmail(valor) {
  return String(valor || "").trim().toLowerCase();
}

function emailValido(email) {
  return email.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarSenha(senha) {
  const senhaTexto = String(senha || "");
  const tamanho = Buffer.byteLength(senhaTexto, "utf8");

  if (tamanho < 8 || tamanho > 72) {
    throw new AppError("A senha deve ter entre 8 e 72 bytes.", 400);
  }

  return senhaTexto;
}

function obterBcryptRounds() {
  const rounds = Number(process.env.BCRYPT_ROUNDS);
  return Number.isInteger(rounds) && rounds >= 10 && rounds <= 14
    ? rounds
    : 10;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function obterUrlPublica() {
  const valor = String(
    process.env.PUBLIC_APP_URL || "https://app.agendafashion.com.br"
  ).trim();
  const url = new URL(valor);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("PUBLIC_APP_URL precisa usar HTTP ou HTTPS.");
  }

  return url;
}

async function solicitarRedefinicao({ email }) {
  const emailNormalizado = normalizarEmail(email);

  if (!emailValido(emailNormalizado)) {
    throw new AppError("Digite um e-mail válido.", 400);
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const usuario = await authRepository.buscarUsuarioPorEmail(emailNormalizado);

  if (!usuario || usuario.ativo === false) {
    return { mensagem: RESPOSTA_NEUTRA };
  }

  try {
    await passwordResetRepository.substituirToken({
      usuarioId: usuario.id,
      tokenHash,
      expiraEm: new Date(Date.now() + DURACAO_TOKEN_MS),
    });

    const url = new URL("/redefinir-senha", obterUrlPublica());
    url.searchParams.set("token", token);

    await emailProvider.enviarRedefinicaoSenha({
      destinatario: usuario.email,
      nome: usuario.nome,
      link: url.toString(),
    });
  } catch (erro) {
    await passwordResetRepository.invalidarToken(tokenHash).catch(() => {});
    registrador.erro("Não foi possível processar a recuperação de senha.", {
      codigo: erro?.code || null,
      status: erro?.status || null,
    });
  }

  return { mensagem: RESPOSTA_NEUTRA };
}

async function redefinirSenha({ token, senha }) {
  const tokenTexto = String(token || "").trim();

  if (!/^[A-Za-z0-9_-]{43}$/.test(tokenTexto)) {
    throw new AppError("Este link de recuperação é inválido ou expirou.", 400);
  }

  const senhaTexto = validarSenha(senha);
  const senhaHash = await bcrypt.hash(senhaTexto, obterBcryptRounds());
  const resultado = await passwordResetRepository.redefinirSenha({
    tokenHash: hashToken(tokenTexto),
    senhaHash,
  });

  if (!resultado) {
    throw new AppError("Este link de recuperação é inválido ou expirou.", 400);
  }

  return {
    mensagem: "Senha alterada com sucesso. Entre com sua nova senha.",
  };
}

module.exports = {
  solicitarRedefinicao,
  redefinirSenha,
  hashToken,
};
