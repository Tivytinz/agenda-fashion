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

function primeiroSinalGoogle(...valores) {
  for (const valor of valores) {
    const normalizado = normalizarTexto(valor, 200);
    if (normalizado) return normalizado;
  }
  return null;
}

function ehGoogle(
  origem,
  sinalGoogle
) {
  return String(
    origem || ""
  ).trim().toLowerCase() === "google" ||
    Boolean(sinalGoogle);
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
    gbraid,
    wbraid,
    fbclid,
    msclkid,
    ttclid,
    epik,
    landing,
  }
) {
  const temSinalGoogle =
    Boolean(
      primeiroSinalGoogle(
        marketing[gclid],
        marketing[gbraid],
        marketing[wbraid]
      )
    );

  if (temSinalGoogle) {
    marketing[source] = "google";
    marketing[medium] = "cpc";
    marketing[fbclid] = null;
    marketing[msclkid] = null;
    marketing[ttclid] = null;
    marketing[epik] = null;

    if (
      !campanhaOficial(
        marketing[campaign]
      )
    ) {
      marketing[campaign] = null;
    }

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
    marketing[msclkid] = null;
    marketing[ttclid] = null;
    marketing[epik] = null;
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
  marketing[gbraid] = null;
  marketing[wbraid] = null;
  marketing[fbclid] = null;
  marketing[msclkid] = null;
  marketing[ttclid] = null;
  marketing[epik] = null;
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
      gbraid: "gbraid",
      wbraid: "wbraid",
      fbclid: "fbclid",
      msclkid: "msclkid",
      ttclid: "ttclid",
      epik: "epik",
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
      gbraid: "lastGbraid",
      wbraid: "lastWbraid",
      fbclid: "lastFbclid",
      msclkid: "lastMsclkid",
      ttclid: "lastTtclid",
      epik: "lastEpik",
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
  const consentimentoMarketing =
    entrada.consentimento_marketing === true ||
    entrada.consentimentoMarketing === true;

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
        200
      ),
    gbraid:
      normalizarTexto(
        entrada.gbraid,
        200
      ),
    wbraid:
      normalizarTexto(
        entrada.wbraid,
        200
      ),
    fbclid:
      normalizarTexto(
        entrada.fbclid,
        200
      ),
    msclkid:
      normalizarTexto(
        entrada.msclkid,
        200
      ),
    ttclid:
      normalizarTexto(
        entrada.ttclid,
        200
      ),
    epik:
      normalizarTexto(
        entrada.epik,
        200
      ),
    afSource:
      normalizarTexto(
        entrada.af_source ??
        entrada.afSource,
        80
      ),
    afMedium:
      normalizarTexto(
        entrada.af_medium ??
        entrada.afMedium,
        80
      ),
    afContent:
      normalizarTexto(
        entrada.af_content ??
        entrada.afContent,
        80
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
        200
      ),
    lastGbraid:
      normalizarTexto(
        entrada.last_gbraid ??
        entrada.lastGbraid,
        200
      ),
    lastWbraid:
      normalizarTexto(
        entrada.last_wbraid ??
        entrada.lastWbraid,
        200
      ),
    lastFbclid:
      normalizarTexto(
        entrada.last_fbclid ??
        entrada.lastFbclid,
        200
      ),
    lastMsclkid:
      normalizarTexto(
        entrada.last_msclkid ??
        entrada.lastMsclkid,
        200
      ),
    lastTtclid:
      normalizarTexto(
        entrada.last_ttclid ??
        entrada.lastTtclid,
        200
      ),
    lastEpik:
      normalizarTexto(
        entrada.last_epik ??
        entrada.lastEpik,
        200
      ),
    lastAfSource:
      normalizarTexto(
        entrada.last_af_source ??
        entrada.lastAfSource,
        80
      ),
    lastAfMedium:
      normalizarTexto(
        entrada.last_af_medium ??
        entrada.lastAfMedium,
        80
      ),
    lastAfContent:
      normalizarTexto(
        entrada.last_af_content ??
        entrada.lastAfContent,
        80
      ),
    lastLandingPage:
      normalizarLanding(
        entrada.last_landing_page ??
        entrada.lastLandingPage
      ),
  };

  if (!consentimentoMarketing) {
    for (const chave of Object.keys(normalizado)) {
      if (
        chave !== "intencao" &&
        chave !== "sessaoId"
      ) {
        normalizado[chave] = null;
      }
    }

    return normalizado;
  }

  return limparGoogleProfissionalNaoOficial(normalizado);
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
  primeiroSinalGoogle,
  CAMPANHA_GOOGLE_PROFISSIONAIS_OFICIAL,
};
