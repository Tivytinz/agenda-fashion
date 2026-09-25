const {
  COOKIE_DESENVOLVIMENTO,
  COOKIE_PRODUCAO,
} = require(
  "../config/sessionCookie"
);

const {
  obterOrigensPermitidas,
} = require(
  "../config/cors"
);

const METODOS_SEGUROS =
  new Set([
    "GET",
    "HEAD",
    "OPTIONS",
  ]);

function normalizarOrigem(
  valor
) {
  try {
    return new URL(
      String(valor || "")
    ).origin;
  } catch {
    return null;
  }
}

function possuiCookieSessao(
  req
) {
  const header =
    String(
      req.headers?.cookie ||
      ""
    );

  if (!header) {
    return false;
  }

  const nomes =
    new Set([
      COOKIE_PRODUCAO,
      COOKIE_DESENVOLVIMENTO,
    ]);

  return header
    .split(";")
    .some((parte) => {
      const separador =
        parte.indexOf("=");

      if (separador <= 0) {
        return false;
      }

      const nome =
        parte
          .slice(
            0,
            separador
          )
          .trim();

      return nomes.has(
        nome
      );
    });
}

function origemDaRequisicao(
  req
) {
  const host =
    String(
      req.get?.("host") ||
      ""
    ).trim();

  if (!host) {
    return null;
  }

  const protocoloEncaminhado =
    String(
      req.get?.(
        "x-forwarded-proto"
      ) ||
      ""
    )
      .split(",")[0]
      .trim();

  const protocolo =
    protocoloEncaminhado ||
    req.protocol ||
    "http";

  return normalizarOrigem(
    `${protocolo}://${host}`
  );
}

function origemPermitida(
  req,
  valor
) {
  const origem =
    normalizarOrigem(
      valor
    );

  if (!origem) {
    return false;
  }

  if (
    origem ===
    origemDaRequisicao(req)
  ) {
    return true;
  }

  return obterOrigensPermitidas()
    .has(origem);
}

function erroCsrf() {
  const erro =
    new Error(
      "Origem não autorizada para esta operação."
    );

  erro.statusCode =
    403;

  erro.codigo =
    "CSRF_ORIGIN_INVALID";

  return erro;
}

function csrfProtection(
  req,
  _res,
  next
) {
  if (
    METODOS_SEGUROS.has(
      String(
        req.method ||
        ""
      ).toUpperCase()
    ) ||
    !possuiCookieSessao(req)
  ) {
    return next();
  }

  const fetchSite =
    String(
      req.get?.(
        "sec-fetch-site"
      ) ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    fetchSite ===
    "cross-site"
  ) {
    return next(
      erroCsrf()
    );
  }

  const origin =
    req.get?.("origin");

  if (origin) {
    return origemPermitida(
      req,
      origin
    )
      ? next()
      : next(
          erroCsrf()
        );
  }

  const referer =
    req.get?.("referer");

  if (referer) {
    return origemPermitida(
      req,
      referer
    )
      ? next()
      : next(
          erroCsrf()
        );
  }

  /*
   * Clientes não-browser e testes podem não enviar Origin/Referer.
   * O cookie SameSite=Lax continua sendo a primeira barreira de CSRF.
   * Quando o navegador fornece metadados de origem, eles são validados.
   */
  return next();
}

module.exports = {
  csrfProtection,
  normalizarOrigem,
  origemDaRequisicao,
  origemPermitida,
  possuiCookieSessao,
};
