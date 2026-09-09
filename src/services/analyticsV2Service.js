const analyticsRepository = require(
  "../repositories/analyticsV2Repository"
);

const TIPOS_ITEM = new Set([
  "page_view",
  "engagement",
  "event",
]);

const EVENTOS_FRONTEND = new Set([
  "business_creation_started",
  "first_service_creation_started",
  "profile_shared",
  "booking_started",
  "checkout_viewed",
]);

const MOTIVOS_SAIDA = new Set([
  "navigate",
  "hidden",
  "pagehide",
  "unload",
  "session_end",
]);

const PROPRIEDADES_PERMITIDAS = Object.freeze({
  business_creation_started: new Set(["entry_point"]),
  first_service_creation_started: new Set(["entry_point"]),
  profile_shared: new Set(["method"]),
  booking_started: new Set(["entry_point"]),
  checkout_viewed: new Set(["plan_slug"]),
});

const SEARCH_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "bing.com",
  "www.bing.com",
  "search.yahoo.com",
  "duckduckgo.com",
]);

const AI_HOSTS = new Set([
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "www.perplexity.ai",
  "claude.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
]);

const SOCIAL_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "tiktok.com",
  "www.tiktok.com",
  "pinterest.com",
  "www.pinterest.com",
]);

function criarErro(mensagem, statusCode = 400, codigo = "ANALYTICS_INVALIDO") {
  const erro = new Error(mensagem);
  erro.status = statusCode;
  erro.statusCode = statusCode;
  erro.code = codigo;
  return erro;
}

function uuidValido(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(valor || "").trim());
}

function textoSeguro(valor, limite, { lower = false } = {}) {
  let texto = String(valor ?? "")
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, limite);

  if (lower) texto = texto.toLowerCase();
  return texto;
}

function idSeguro(valor) {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0
    ? numero
    : null;
}

function timestampSeguro(valor) {
  const data = new Date(valor);
  const timestamp = data.getTime();

  if (!Number.isFinite(timestamp)) {
    throw criarErro("Horário do evento inválido.");
  }

  const agora = Date.now();
  const passadoMaximo = 31 * 24 * 60 * 60 * 1000;
  const futuroMaximo = 5 * 60 * 1000;

  if (timestamp < agora - passadoMaximo || timestamp > agora + futuroMaximo) {
    throw criarErro("Horário do evento fora da janela aceita.");
  }

  return data.toISOString();
}

function pageKeySeguro(valor) {
  const key = textoSeguro(valor, 80, { lower: true });
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(key)) {
    throw criarErro("Identificador de tela inválido.");
  }
  return key;
}

function routeTemplateSeguro(valor) {
  const route = String(valor || "").trim().slice(0, 160);
  if (
    !route.startsWith("/") ||
    route.startsWith("//") ||
    route.includes("?") ||
    route.includes("#") ||
    route.includes("\\")
  ) {
    throw criarErro("Template de rota inválido.");
  }
  return route;
}

function deviceSeguro(device = {}) {
  return {
    deviceType: textoSeguro(device.type, 20, { lower: true }) || null,
    browserFamily: textoSeguro(device.browser, 40) || null,
    browserMajor: textoSeguro(device.browserMajor, 12) || null,
    osFamily: textoSeguro(device.os, 40) || null,
  };
}

function propriedadesSeguras(nome, propriedades) {
  if (!propriedades || typeof propriedades !== "object" || Array.isArray(propriedades)) {
    return {};
  }

  const permitidas = PROPRIEDADES_PERMITIDAS[nome] || new Set();
  const resultado = {};

  for (const chave of permitidas) {
    if (!Object.prototype.hasOwnProperty.call(propriedades, chave)) continue;
    const valor = propriedades[chave];

    if (["string", "number", "boolean"].includes(typeof valor)) {
      resultado[chave] = typeof valor === "string"
        ? textoSeguro(valor, 120)
        : valor;
    }
  }

  return resultado;
}

function normalizarHost(valor) {
  const host = textoSeguro(valor, 200, { lower: true });
  if (!host || !/^[a-z0-9.-]+$/.test(host)) return null;
  return host;
}

function normalizarLandingPage(valor) {
  const path = String(valor || "").trim().slice(0, 500);
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return null;
  }

  return path.split(/[?#]/, 1)[0].slice(0, 500);
}

function normalizarAquisicao(valor) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return null;
  }

  const texto = (campo, limite, lower = false) => {
    const resultado = textoSeguro(valor[campo], limite, { lower });
    return resultado || null;
  };

  return {
    utmSource: texto("utmSource", 80, true),
    utmMedium: texto("utmMedium", 80, true),
    utmCampaign: texto("utmCampaign", 140, true),
    utmContent: texto("utmContent", 140),
    utmTerm: texto("utmTerm", 140),
    gclid: texto("gclid", 200),
    gbraid: texto("gbraid", 200),
    wbraid: texto("wbraid", 200),
    fbclid: texto("fbclid", 200),
    msclkid: texto("msclkid", 200),
    ttclid: texto("ttclid", 200),
    landingPage: normalizarLandingPage(valor.landingPage),
    referrerHost: normalizarHost(valor.referrerHost),
  };
}

function hostPertence(host, conjunto) {
  if (!host) return false;
  if (conjunto.has(host)) return true;

  return Array.from(conjunto).some(
    (base) => host.endsWith(`.${base}`)
  );
}

function classificarCanal(evidencias, campanhaOficial) {
  const source = evidencias?.utmSource || "";
  const medium = evidencias?.utmMedium || "";
  const host = evidencias?.referrerHost || "";
  const temGoogleClick = Boolean(
    evidencias?.gclid || evidencias?.gbraid || evidencias?.wbraid
  );
  const temMicrosoftClick = Boolean(evidencias?.msclkid);
  const temSocialClick = Boolean(evidencias?.fbclid || evidencias?.ttclid);
  const midiaBuscaPaga = [
    "cpc",
    "ppc",
    "paid_search",
    "paidsearch",
    "sem",
  ].includes(medium);
  const midiaSocialPaga = [
    "paid_social",
    "paidsocial",
    "social_paid",
  ].includes(medium);

  let canal = "unknown";
  let classificacao = "sem_evidencia";
  let metodoResolucao = "sem_evidencia";

  if (temGoogleClick || temMicrosoftClick || midiaBuscaPaga) {
    canal = "paid_search";
    classificacao = campanhaOficial ? "oficial" : "evidencia_paga";
    metodoResolucao = campanhaOficial ? "campanha_oficial" : "click_id_ou_utm";
  } else if (temSocialClick || midiaSocialPaga) {
    canal = "paid_social";
    classificacao = campanhaOficial ? "oficial" : "evidencia_paga";
    metodoResolucao = campanhaOficial ? "campanha_oficial" : "click_id_ou_utm";
  } else if (medium === "email") {
    canal = "email";
    classificacao = campanhaOficial ? "oficial" : "utm_rastreada";
    metodoResolucao = campanhaOficial ? "campanha_oficial" : "utm";
  } else if (hostPertence(host, AI_HOSTS)) {
    canal = "ai_assistant";
    classificacao = "referencia_rastreada";
    metodoResolucao = "referrer";
  } else if (hostPertence(host, SEARCH_HOSTS)) {
    canal = "organic_search";
    classificacao = "referencia_rastreada";
    metodoResolucao = "referrer";
  } else if (
    hostPertence(host, SOCIAL_HOSTS) ||
    ["social", "organic_social"].includes(medium) ||
    ["instagram", "facebook", "tiktok", "pinterest"].includes(source)
  ) {
    canal = "organic_social";
    classificacao = campanhaOficial ? "oficial" : "referencia_rastreada";
    metodoResolucao = campanhaOficial ? "campanha_oficial" : "utm_ou_referrer";
  } else if (host) {
    canal = "referral";
    classificacao = "referencia_rastreada";
    metodoResolucao = "referrer";
  } else if (source || medium || evidencias?.utmCampaign) {
    canal = "other";
    classificacao = campanhaOficial ? "oficial" : "utm_rastreada";
    metodoResolucao = campanhaOficial ? "campanha_oficial" : "utm";
  } else {
    canal = "direct";
    classificacao = "sem_evidencia";
    metodoResolucao = "sem_referrer_ou_utm";
  }

  return {
    canal,
    classificacao,
    metodoResolucao,
    source: source || host || (canal === "direct" ? "direct" : null),
    medium: medium || (
      canal === "direct"
        ? "none"
        : canal === "organic_search"
          ? "organic"
          : canal === "referral" || canal === "ai_assistant"
            ? "referral"
            : canal === "organic_social"
              ? "social"
              : null
    ),
  };
}

function normalizarItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw criarErro("Item de analytics inválido.");
  }

  const type = textoSeguro(item.type, 20, { lower: true });
  if (!TIPOS_ITEM.has(type)) {
    throw criarErro("Tipo de analytics não suportado.");
  }

  const occurredAt = timestampSeguro(item.occurredAt);

  if (type === "page_view") {
    if (!uuidValido(item.viewUuid)) {
      throw criarErro("Identificador da visualização inválido.");
    }

    const sequencia = Number(item.sequence);
    if (!Number.isInteger(sequencia) || sequencia < 1 || sequencia > 10000) {
      throw criarErro("Sequência da visualização inválida.");
    }

    return {
      type,
      occurredAt,
      viewUuid: String(item.viewUuid).toLowerCase(),
      sequence: sequencia,
      pageKey: pageKeySeguro(item.pageKey),
      routeTemplate: routeTemplateSeguro(item.routeTemplate),
      targetBusinessId: idSeguro(item.targetBusinessId),
      targetServiceId: idSeguro(item.targetServiceId),
    };
  }

  if (type === "engagement") {
    if (!uuidValido(item.viewUuid)) {
      throw criarErro("Identificador da visualização inválido.");
    }

    const engagedMs = Number(item.engagedMs);
    if (!Number.isInteger(engagedMs) || engagedMs < 0 || engagedMs > 12 * 60 * 60 * 1000) {
      throw criarErro("Tempo engajado inválido.");
    }

    const motivo = textoSeguro(item.reason, 24, { lower: true });
    return {
      type,
      occurredAt,
      viewUuid: String(item.viewUuid).toLowerCase(),
      engagedMs,
      reason: MOTIVOS_SAIDA.has(motivo) ? motivo : null,
      close: item.close === true,
    };
  }

  if (!uuidValido(item.eventUuid)) {
    throw criarErro("Identificador do evento inválido.");
  }

  const nome = textoSeguro(item.name, 80, { lower: true });
  if (!EVENTOS_FRONTEND.has(nome)) {
    throw criarErro("Evento frontend não permitido.");
  }

  const schemaVersion = Number(item.schemaVersion || 1);
  if (!Number.isInteger(schemaVersion) || schemaVersion !== 1) {
    throw criarErro("Versão de evento não suportada.");
  }

  const viewUuid = item.viewUuid && uuidValido(item.viewUuid)
    ? String(item.viewUuid).toLowerCase()
    : null;
  const flowUuid = item.flowUuid && uuidValido(item.flowUuid)
    ? String(item.flowUuid).toLowerCase()
    : null;

  return {
    type,
    occurredAt,
    eventUuid: String(item.eventUuid).toLowerCase(),
    viewUuid,
    flowUuid,
    name: nome,
    schemaVersion,
    targetBusinessId: idSeguro(item.targetBusinessId),
    targetServiceId: idSeguro(item.targetServiceId),
    properties: propriedadesSeguras(nome, item.properties),
  };
}

async function registrarOrigem({
  sessaoId,
  aquisicao,
  primeiroHorario,
  normalizados,
  client,
}) {
  const evidencias = aquisicao || {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    gclid: null,
    gbraid: null,
    wbraid: null,
    fbclid: null,
    msclkid: null,
    ttclid: null,
    landingPage: null,
    referrerHost: null,
  };

  const campanhaOficial = await analyticsRepository.buscarCampanhaOficial({
    utmSource: evidencias.utmSource,
    utmMedium: evidencias.utmMedium,
    utmCampaign: evidencias.utmCampaign,
    occurredAt: primeiroHorario,
  }, client);

  const origem = classificarCanal(evidencias, campanhaOficial);
  const primeiraTela = normalizados.find((item) => item.type === "page_view");

  await analyticsRepository.salvarEvidenciasSessao({
    sessaoId,
    evidencias,
    occurredAt: primeiroHorario,
  }, client);

  await analyticsRepository.salvarOrigemSessao({
    sessaoId,
    canal: origem.canal,
    source: origem.source,
    medium: origem.medium,
    referrerHost: evidencias.referrerHost,
    landingPageKey: primeiraTela?.pageKey || null,
    campanhaOficialId: campanhaOficial?.id || null,
    classificacao: origem.classificacao,
    metodoResolucao: origem.metodoResolucao,
    occurredAt: primeiroHorario,
  }, client);
}

async function coletar({ usuarioId, body }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw criarErro("Payload de analytics inválido.");
  }

  if (!uuidValido(body.visitorUuid) || !uuidValido(body.sessionUuid)) {
    throw criarErro("Identidade de analytics inválida.");
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length < 1 || items.length > 20) {
    throw criarErro("Envie entre 1 e 20 itens de analytics por lote.");
  }

  const normalizados = items.map(normalizarItem);
  const primeiroHorario = normalizados.reduce(
    (menor, item) => item.occurredAt < menor ? item.occurredAt : menor,
    normalizados[0].occurredAt
  );
  const ultimoHorario = normalizados.reduce(
    (maior, item) => item.occurredAt > maior ? item.occurredAt : maior,
    normalizados[0].occurredAt
  );
  const device = deviceSeguro(body.device);
  const aquisicao = normalizarAquisicao(body.acquisition);

  return analyticsRepository.executarTransacao(async (client) => {
    const visitante = await analyticsRepository.upsertVisitante({
      visitorUuid: String(body.visitorUuid).toLowerCase(),
      occurredAt: ultimoHorario,
    }, client);

    const sessao = await analyticsRepository.upsertSessao({
      sessionUuid: String(body.sessionUuid).toLowerCase(),
      visitanteId: visitante.id,
      usuarioId: idSeguro(usuarioId),
      occurredAt: primeiroHorario,
      ...device,
    }, client);

    if (!sessao) {
      throw criarErro(
        "Sessão de analytics conflita com outra identidade.",
        409,
        "ANALYTICS_SESSION_CONFLICT"
      );
    }

    if (usuarioId) {
      await analyticsRepository.vincularIdentidade({
        visitanteId: visitante.id,
        usuarioId: idSeguro(usuarioId),
        vinculoTipo: "login_autenticado",
        occurredAt: ultimoHorario,
      }, client);
    }

    await registrarOrigem({
      sessaoId: sessao.id,
      aquisicao,
      primeiroHorario,
      normalizados,
      client,
    });

    const actorBusinessId = await analyticsRepository.resolverNegocioDoAtor(
      idSeguro(usuarioId),
      client
    );

    let gravados = 0;

    for (const item of normalizados) {
      if (item.type === "page_view") {
        const salvo = await analyticsRepository.registrarVisualizacao({
          ...item,
          sessaoId: sessao.id,
        }, client);
        if (salvo) gravados += 1;
        continue;
      }

      if (item.type === "engagement") {
        const salvo = await analyticsRepository.registrarEngajamento({
          ...item,
          sessaoId: sessao.id,
          motivoSaida: item.reason,
          encerrar: item.close,
        }, client);
        if (salvo) gravados += 1;
        continue;
      }

      const visualizacao = item.viewUuid
        ? await analyticsRepository.buscarVisualizacaoPorUuid(
            item.viewUuid,
            sessao.id,
            client
          )
        : null;

      const salvo = await analyticsRepository.registrarEvento({
        ...item,
        sessaoId: sessao.id,
        visualizacaoId: visualizacao?.id || null,
        nome: item.name,
        origem: "frontend",
        actorUserId: idSeguro(usuarioId),
        actorBusinessId,
        propriedades: item.properties,
      }, client);
      if (salvo) gravados += 1;
    }

    const resumo = await analyticsRepository.recalcularSessao(
      sessao.id,
      ultimoHorario,
      client
    );

    return {
      recebido: true,
      gravados,
      sessionUuid: sessao.session_uuid,
      resumo,
    };
  });
}

module.exports = {
  coletar,
  normalizarItem,
  normalizarAquisicao,
  classificarCanal,
  uuidValido,
};
