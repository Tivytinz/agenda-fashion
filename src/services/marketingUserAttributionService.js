const AppError = require(
  "../errors/AppError"
);

const marketingUserAttributionRepository =
  require(
    "../repositories/marketingUserAttributionRepository"
  );

const INTENCOES = new Set([
  "indefinida",
  "cliente",
  "profissional",
]);

function normalizarUsuarioId(valor) {
  const id = Number(valor);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      "Usuário inválido para atribuição.",
      400
    );
  }

  return id;
}

function normalizarTexto(
  valor,
  limite
) {
  const texto = String(
    valor ?? ""
  ).trim();

  return texto
    ? texto.slice(0, limite)
    : null;
}

function normalizarIntencao(valor) {
  const intencao = String(
    valor || "indefinida"
  )
    .trim()
    .toLowerCase();

  return INTENCOES.has(intencao)
    ? intencao
    : "indefinida";
}

function normalizarSessao(valor) {
  const sessao =
    normalizarTexto(valor, 64);

  if (!sessao) {
    return null;
  }

  return /^[A-Za-z0-9_-]{8,64}$/
    .test(sessao)
      ? sessao
      : null;
}

function normalizarLanding(valor) {
  const landing =
    normalizarTexto(valor, 500);

  if (!landing) {
    return null;
  }

  if (
    !landing.startsWith("/") ||
    landing.startsWith("//") ||
    landing.includes("\\") ||
    /[\u0000-\u001F\u007F]/
      .test(landing)
  ) {
    return null;
  }

  return landing;
}

function normalizarMarketing(
  marketing = {}
) {
  const entrada =
    marketing &&
    typeof marketing === "object" &&
    !Array.isArray(marketing)
      ? marketing
      : {};

  return {
    intencao:
      normalizarIntencao(
        entrada.intencao
      ),
    sessaoId:
      normalizarSessao(
        entrada.sessao_id ??
        entrada.sessaoId
      ),
    utmSource:
      normalizarTexto(
        entrada.utm_source ??
        entrada.utmSource,
        80
      ),
    utmMedium:
      normalizarTexto(
        entrada.utm_medium ??
        entrada.utmMedium,
        80
      ),
    utmCampaign:
      normalizarTexto(
        entrada.utm_campaign ??
        entrada.utmCampaign,
        140
      ),
    utmContent:
      normalizarTexto(
        entrada.utm_content ??
        entrada.utmContent,
        140
      ),
    utmTerm:
      normalizarTexto(
        entrada.utm_term ??
        entrada.utmTerm,
        140
      ),
    gclid:
      normalizarTexto(
        entrada.gclid,
        160
      ),
    fbclid:
      normalizarTexto(
        entrada.fbclid,
        160
      ),
    landingPage:
      normalizarLanding(
        entrada.landing_page ??
        entrada.landingPage
      ),
  };
}

async function registrarContaCriada({
  usuarioId,
  marketing,
}) {
  return marketingUserAttributionRepository
    .registrarConta({
      usuarioId:
        normalizarUsuarioId(
          usuarioId
        ),
      ...normalizarMarketing(
        marketing
      ),
    });
}

async function marcarIntencaoProfissional(
  usuarioId
) {
  return marketingUserAttributionRepository
    .marcarIntencaoProfissional(
      normalizarUsuarioId(
        usuarioId
      )
    );
}

module.exports = {
  registrarContaCriada,
  marcarIntencaoProfissional,
  normalizarMarketing,
};
