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
  uuidValido,
};
