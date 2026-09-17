const crypto = require(
  "crypto"
);

const jwt = require(
  "jsonwebtoken"
);

function obterJwtSecret() {
  const segredo =
    String(
      process.env.JWT_SECRET ||
        ""
    ).trim();

  if (!segredo) {
    throw new Error(
      "JWT_SECRET não configurado nas variáveis de ambiente."
    );
  }

  return segredo;
}

function hashToken(token) {
  const valor =
    String(token || "");

  if (!valor) {
    return null;
  }

  return crypto
    .createHash("sha256")
    .update(valor, "utf8")
    .digest("hex");
}

function verificarToken(token) {
  return jwt.verify(
    token,
    obterJwtSecret(),
    {
      algorithms: [
        "HS256",
      ],
    }
  );
}

module.exports = {
  hashToken,
  verificarToken,
};
