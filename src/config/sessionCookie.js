const jwt = require(
  "jsonwebtoken"
);

const COOKIE_PRODUCAO =
  "__Host-af_session";
const COOKIE_DESENVOLVIMENTO =
  "af_session";
const DURACAO_PADRAO_MS =
  7 * 24 * 60 * 60 * 1000;

function emProducao() {
  return process.env.NODE_ENV ===
    "production";
}

function obterNomeCookie() {
  return emProducao()
    ? COOKIE_PRODUCAO
    : COOKIE_DESENVOLVIMENTO;
}

function obterOpcoesCookie({
  maxAge,
  secure = emProducao(),
} = {}) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    ...(Number.isFinite(maxAge) &&
    maxAge > 0
      ? {
          maxAge,
        }
      : {}),
  };
}

function obterDuracaoToken(
  token
) {
  const payload =
    jwt.decode(token);

  const expiraEm =
    Number(payload?.exp) * 1000;

  if (
    !Number.isFinite(expiraEm)
  ) {
    return DURACAO_PADRAO_MS;
  }

  return Math.max(
    1000,
    expiraEm - Date.now()
  );
}

function definirCookieSessao(
  res,
  token
) {
  if (!token) {
    return;
  }

  res.cookie(
    obterNomeCookie(),
    token,
    obterOpcoesCookie({
      maxAge:
        obterDuracaoToken(token),
    })
  );
}

function limparCookieSessao(
  res
) {
  const nomes = new Set([
    obterNomeCookie(),
    COOKIE_PRODUCAO,
    COOKIE_DESENVOLVIMENTO,
  ]);

  for (const nome of nomes) {
    res.clearCookie(
      nome,
      obterOpcoesCookie({
        secure:
          nome === COOKIE_PRODUCAO ||
          emProducao(),
      })
    );
  }
}

function obterTokenBearer(
  authHeader
) {
  if (!authHeader) {
    return null;
  }

  const partes =
    String(authHeader)
      .trim()
      .split(/\s+/);

  if (
    partes.length !== 2 ||
    partes[0].toLowerCase() !==
      "bearer" ||
    !partes[1]
  ) {
    return null;
  }

  return partes[1];
}

function obterCookies(
  cookieHeader
) {
  const cookies =
    new Map();

  for (
    const parte
    of String(cookieHeader || "")
      .split(";")
  ) {
    const separador =
      parte.indexOf("=");

    if (separador <= 0) {
      continue;
    }

    const nome =
      parte.slice(0, separador)
        .trim();
    const valor =
      parte.slice(separador + 1)
        .trim();

    if (!nome || !valor) {
      continue;
    }

    try {
      cookies.set(
        nome,
        decodeURIComponent(valor)
      );
    } catch {
      cookies.set(
        nome,
        valor
      );
    }
  }

  return cookies;
}

function obterTokenDaRequisicao(
  req
) {
  const bearer =
    obterTokenBearer(
      req.headers.authorization
    );

  if (bearer) {
    return {
      token: bearer,
      origem: "bearer",
    };
  }

  const cookies =
    obterCookies(
      req.headers.cookie
    );

  for (const nome of [
    COOKIE_PRODUCAO,
    COOKIE_DESENVOLVIMENTO,
  ]) {
    const token =
      cookies.get(nome);

    if (token) {
      return {
        token,
        origem: "cookie",
      };
    }
  }

  return {
    token: null,
    origem: null,
  };
}

module.exports = {
  COOKIE_PRODUCAO,
  COOKIE_DESENVOLVIMENTO,
  definirCookieSessao,
  limparCookieSessao,
  obterDuracaoToken,
  obterNomeCookie,
  obterOpcoesCookie,
  obterTokenBearer,
  obterTokenDaRequisicao,
};
