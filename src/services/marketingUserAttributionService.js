const AppError = require(
  "../errors/AppError"
);

const marketingUserAttributionRepository =
  require(
    "../repositories/marketingUserAttributionRepository"
  );

const CAMPANHA_GOOGLE_PROFISSIONAIS_OFICIAL =
  "google_ads_profissionais";

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

function ehGoogle(
  origem,
  gclid
) {
  return String(
    origem || ""
  ).trim().toLowerCase() === "google" ||
    Boolean(gclid);
}

function campanhaOficial(
  campanha
) {
  return String(
    campanha || ""
  ).trim().toLowerCase() ===
    CAMPANHA_GOOGLE_PROFISSIONAIS_OFICIAL;
}

function limparToqueGoogleNaoOficial(
  marketing,
  {
    source,
    medium,
    campaign,
    content,
    term,
    gclid,
    fbclid,
    landing,
  }
) {
  const temGclid =
    Boolean(marketing[gclid]);

  if (temGclid) {
    marketing[source] = "google";
    marketing[medium] = "cpc";
    marketing[fbclid] = null;
    return;
  }

  if (
    campanhaOficial(
      marketing[campaign]
    )
  ) {
    marketing[source] = "google";
    marketing[medium] = "cpc";
    marketing[fbclid] = null;
    return;
  }

  if (
    !ehGoogle(
      marketing[source],
      null
    )
  ) {
    return;
  }

  marketing[source] = null;
  marketing[medium] = null;
  marketing[campaign] = null;
  marketing[content] = null;
  marketing[term] = null;
  marketing[gclid] = null;
  marketing[fbclid] = null;
  marketing[landing] = null;
}

function limparGoogleProfissionalNaoOficial(
  marketing
) {
  if (
    marketing.intencao !==
      "profissional"
  ) {
    return marketing;
  }

  limparToqueGoogleNaoOficial(
    marketing,
    {
      source: "utmSource",
      medium: "utmMedium",
      campaign: "utmCampaign",
      content: "utmContent",
      term: "utmTerm",
      gclid: "gclid",
      fbclid: "fbclid",
      landing: "landingPage",
    }
  );

  limparToqueGoogleNaoOficial(
    marketing,
    {
      source: "lastUtmSource",
      medium: "lastUtmMedium",
      campaign: "lastUtmCampaign",
      content: "lastUtmContent",
      term: "lastUtmTerm",
      gclid: "lastGclid",
      fbclid: "lastFbclid",
      landing: "lastLandingPage",
    }
  );

  return marketing;
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

  const normalizado = {
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
    lastUtmSource:
      normalizarTexto(
        entrada.last_utm_source ??
        entrada.lastUtmSource,
        80
      ),
    lastUtmMedium:
      normalizarTexto(
        entrada.last_utm_medium ??
        entrada.lastUtmMedium,
        80
      ),
    lastUtmCampaign:
      normalizarTexto(
        entrada.last_utm_campaign ??
        entrada.lastUtmCampaign,
        140
      ),
    lastUtmContent:
      normalizarTexto(
        entrada.last_utm_content ??
        entrada.lastUtmContent,
        140
      ),
    lastUtmTerm:
      normalizarTexto(
        entrada.last_utm_term ??
        entrada.lastUtmTerm,
        140
      ),
    lastGclid:
      normalizarTexto(
        entrada.last_gclid ??
        entrada.lastGclid,
        160
      ),
    lastFbclid:
      normalizarTexto(
        entrada.last_fbclid ??
        entrada.lastFbclid,
        160
      ),
    lastLandingPage:
      normalizarLanding(
        entrada.last_landing_page ??
        entrada.lastLandingPage
      ),
  };

  return limparGoogleProfissionalNaoOficial(
    normalizado
  );
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
  limparGoogleProfissionalNaoOficial,
  CAMPANHA_GOOGLE_PROFISSIONAIS_OFICIAL,
};
