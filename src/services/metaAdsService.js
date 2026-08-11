const crypto = require("crypto");

const metaAdsRepository = require(
  "../repositories/metaAdsRepository"
);
const registrador = require(
  "../utils/registrador"
);

const DEFAULT_GRAPH_VERSION = "v25.0";
const DEFAULT_TIMEOUT_MS = 1800;

function normalizarTexto(valor) {
  return String(valor ?? "").trim();
}

function flagAtiva(valor) {
  return ["1", "true", "yes", "sim", "on"].includes(
    normalizarTexto(valor).toLowerCase()
  );
}

function obterPixelId() {
  const pixelId = normalizarTexto(
    process.env.META_PIXEL_ID
  );

  return /^\d{5,30}$/.test(pixelId)
    ? pixelId
    : "";
}

function obterGraphVersion() {
  const valor = normalizarTexto(
    process.env.META_GRAPH_API_VERSION
  );

  return /^v\d+\.\d+$/.test(valor)
    ? valor
    : DEFAULT_GRAPH_VERSION;
}

function obterTimeoutMs() {
  const valor = Number(
    process.env.META_CAPI_TIMEOUT_MS
  );

  return Number.isInteger(valor) &&
    valor >= 500 &&
    valor <= 5000
    ? valor
    : DEFAULT_TIMEOUT_MS;
}

function pixelHabilitado() {
  return flagAtiva(
    process.env.META_ADS_ENABLED
  ) && Boolean(obterPixelId());
}

function capiHabilitada() {
  return pixelHabilitado() && Boolean(
    normalizarTexto(
      process.env.META_CAPI_ACCESS_TOKEN
    )
  );
}

function obterConfiguracaoPublica() {
  return {
    enabled: pixelHabilitado(),
    pixelId: pixelHabilitado()
      ? obterPixelId()
      : null
  };
}

function normalizarIdentificadorMeta(valor) {
  const texto = normalizarTexto(valor);

  if (
    !texto ||
    texto.length > 255 ||
    !/^[A-Za-z0-9._:-]+$/.test(texto)
  ) {
    return null;
  }

  return texto;
}

function normalizarEventId(valor) {
  const texto = normalizarTexto(valor);

  if (
    texto.length < 8 ||
    texto.length > 120 ||
    !/^[A-Za-z0-9._:-]+$/.test(texto)
  ) {
    return null;
  }

  return texto;
}

function obterOrigemPublica() {
  const configurada = normalizarTexto(
    process.env.PUBLIC_APP_URL
  ) || "https://app.agendafashion.com.br";

  try {
    return new URL(configurada).origin;
  } catch {
    return "https://app.agendafashion.com.br";
  }
}

function normalizarSourceUrl(valor) {
  const origem = obterOrigemPublica();

  try {
    const url = new URL(
      normalizarTexto(valor) || "/",
      origem
    );

    if (url.origin !== origem) {
      return origem;
    }

    return `${url.origin}${url.pathname}`;
  } catch {
    return origem;
  }
}

function sanitizarContextoCliente(meta) {
  const consentimento =
    meta?.consentimento === true;

  return {
    consentimento,
    eventId: normalizarEventId(
      meta?.event_id
    ),
    fbp: consentimento
      ? normalizarIdentificadorMeta(
          meta?.fbp
        )
      : null,
    fbc: consentimento
      ? normalizarIdentificadorMeta(
          meta?.fbc
        )
      : null,
    sourceUrl: normalizarSourceUrl(
      meta?.source_url
    )
  };
}

function criarContextoRequisicao(
  req,
  meta
) {
  const contexto =
    sanitizarContextoCliente(meta);

  return {
    ...contexto,
    clientIp: normalizarTexto(
      req?.ip
    ) || null,
    userAgent: normalizarTexto(
      req?.get?.("user-agent")
    ).slice(0, 500) || null
  };
}

function sha256(valor) {
  return crypto
    .createHash("sha256")
    .update(valor)
    .digest("hex");
}

function normalizarEmail(valor) {
  const email = normalizarTexto(valor)
    .toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null;
}

function normalizarTelefone(valor) {
  let telefone = String(valor ?? "")
    .replace(/\D/g, "");

  if ([10, 11].includes(telefone.length)) {
    telefone = `55${telefone}`;
  }

  return telefone.length >= 10 &&
    telefone.length <= 15
    ? telefone
    : null;
}

function adicionarHash(
  destino,
  chave,
  valor
) {
  if (!valor) {
    return;
  }

  destino[chave] = [
    sha256(valor)
  ];
}

function montarUserData({
  usuarioId,
  email,
  whatsapp,
  contexto,
  perfil
}) {
  const userData = {};

  adicionarHash(
    userData,
    "external_id",
    usuarioId
      ? String(usuarioId)
      : null
  );
  adicionarHash(
    userData,
    "em",
    normalizarEmail(email)
  );
  adicionarHash(
    userData,
    "ph",
    normalizarTelefone(whatsapp)
  );

  const fbp = contexto?.fbp ||
    perfil?.meta_fbp ||
    null;
  const fbc = contexto?.fbc ||
    perfil?.meta_fbc ||
    null;

  if (fbp) {
    userData.fbp = fbp;
  }

  if (fbc) {
    userData.fbc = fbc;
  }

  if (contexto?.clientIp) {
    userData.client_ip_address =
      contexto.clientIp;
  }

  if (contexto?.userAgent) {
    userData.client_user_agent =
      contexto.userAgent;
  }

  return userData;
}

function contextoConsentido(
  contexto,
  perfil
) {
  return Boolean(
    contexto?.consentimento ||
    perfil?.meta_consentido_em
  );
}

async function enviarEvento({
  eventName,
  eventId,
  usuarioId,
  email,
  whatsapp,
  contexto,
  perfil,
  customData
}) {
  if (!capiHabilitada()) {
    return {
      enviado: false,
      motivo: "desabilitado"
    };
  }

  if (!contextoConsentido(
    contexto,
    perfil
  )) {
    return {
      enviado: false,
      motivo: "sem_consentimento"
    };
  }

  const id = normalizarEventId(
    eventId
  );

  if (!id) {
    return {
      enviado: false,
      motivo: "event_id_invalido"
    };
  }

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time:
          Math.floor(Date.now() / 1000),
        event_id: id,
        action_source: "website",
        event_source_url:
          contexto?.sourceUrl ||
          obterOrigemPublica(),
        user_data: montarUserData({
          usuarioId,
          email,
          whatsapp,
          contexto,
          perfil
        }),
        ...(customData
          ? { custom_data: customData }
          : {})
      }
    ]
  };

  const testEventCode = normalizarTexto(
    process.env.META_CAPI_TEST_EVENT_CODE
  );

  if (testEventCode) {
    payload.test_event_code =
      testEventCode;
  }

  const controller =
    new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    obterTimeoutMs()
  );

  try {
    const endpoint =
      `https://graph.facebook.com/${obterGraphVersion()}/${obterPixelId()}/events`;

    const response = await fetch(
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${normalizarTexto(process.env.META_CAPI_ACCESS_TOKEN)}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    );

    const body = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      const erro = new Error(
        "Meta Conversions API rejeitou o evento."
      );
      erro.status = response.status;
      erro.metaCode =
        body?.error?.code || null;
      throw erro;
    }

    return {
      enviado: true,
      eventsReceived:
        body?.events_received ?? null,
      traceId:
        body?.fbtrace_id || null
    };
  } finally {
    clearTimeout(timeout);
  }
}

function registrarFalha(
  evento,
  erro
) {
  registrador.aviso(
    "[Meta Ads] Falha ao enviar conversão. O fluxo do produto foi preservado.",
    {
      evento,
      status: erro?.status || null,
      meta_code:
        erro?.metaCode || null,
      erro:
        erro?.name === "AbortError"
          ? "timeout"
          : erro?.message
    }
  );
}

function dispararSeguro(
  evento,
  tarefa
) {
  void Promise.resolve()
    .then(tarefa)
    .catch((erro) => {
      registrarFalha(
        evento,
        erro
      );
    });
}

async function salvarConsentimento({
  usuarioId,
  meta
}) {
  const contexto =
    sanitizarContextoCliente(meta);

  if (!usuarioId) {
    return null;
  }

  return metaAdsRepository
    .salvarConsentimentoUsuario({
      usuarioId,
      consentido:
        contexto.consentimento,
      fbp: contexto.fbp,
      fbc: contexto.fbc
    });
}

function enviarCadastroProfissionalSeguro({
  usuario,
  marketing,
  contexto
}) {
  if (
    !usuario?.id ||
    marketing?.intencao !==
      "profissional"
  ) {
    return;
  }

  dispararSeguro(
    "CompleteRegistration",
    async () => {
      await salvarConsentimento({
        usuarioId: usuario.id,
        meta: {
          consentimento:
            contexto?.consentimento,
          fbp: contexto?.fbp,
          fbc: contexto?.fbc,
          event_id:
            contexto?.eventId,
          source_url:
            contexto?.sourceUrl
        }
      });

      return enviarEvento({
        eventName:
          "CompleteRegistration",
        eventId:
          contexto?.eventId,
        usuarioId: usuario.id,
        email: usuario.email,
        whatsapp: usuario.whatsapp,
        contexto
      });
    }
  );
}

function enviarCheckoutSeguro({
  usuarioId,
  contexto,
  plano,
  resultado
}) {
  if (!usuarioId) {
    return;
  }

  dispararSeguro(
    "InitiateCheckout",
    async () => {
      await salvarConsentimento({
        usuarioId,
        meta: {
          consentimento:
            contexto?.consentimento,
          fbp: contexto?.fbp,
          fbc: contexto?.fbc,
          event_id:
            contexto?.eventId,
          source_url:
            contexto?.sourceUrl
        }
      });

      const perfil =
        await metaAdsRepository
          .buscarPerfilPorUsuario(
            usuarioId
          );

      return enviarEvento({
        eventName:
          "InitiateCheckout",
        eventId:
          contexto?.eventId,
        usuarioId,
        email: perfil?.email,
        whatsapp: perfil?.whatsapp,
        contexto,
        perfil,
        customData: {
          currency: "BRL",
          value: Number(
            plano?.valor ??
            resultado?.assinatura?.valor ??
            0
          ),
          content_name:
            plano?.nome ||
            "Plano Agenda Fashion"
        }
      });
    }
  );
}

function enviarAssinaturaAtivadaSeguro({
  negocioId,
  assinaturaId,
  pagamentoId,
  valor
}) {
  if (!negocioId || !assinaturaId) {
    return;
  }

  dispararSeguro(
    "Subscribe",
    async () => {
      const perfil =
        await metaAdsRepository
          .buscarPerfilPorNegocio(
            negocioId
          );

      if (!perfil?.meta_consentido_em) {
        return {
          enviado: false,
          motivo: "sem_consentimento"
        };
      }

      const contexto = {
        consentimento: true,
        eventId:
          `subscribe:${assinaturaId}:${pagamentoId || "payment"}`,
        fbp:
          perfil.meta_fbp || null,
        fbc:
          perfil.meta_fbc || null,
        sourceUrl:
          `${obterOrigemPublica()}/painel/assinatura`,
        clientIp: null,
        userAgent: null
      };

      return enviarEvento({
        eventName: "Subscribe",
        eventId: contexto.eventId,
        usuarioId:
          perfil.usuario_id,
        email: perfil.email,
        whatsapp: perfil.whatsapp,
        contexto,
        perfil,
        customData: {
          currency: "BRL",
          value: Number(valor || 0),
          content_name:
            "Assinatura Agenda Fashion"
        }
      });
    }
  );
}

module.exports = {
  obterConfiguracaoPublica,
  sanitizarContextoCliente,
  criarContextoRequisicao,
  salvarConsentimento,
  enviarEvento,
  enviarCadastroProfissionalSeguro,
  enviarCheckoutSeguro,
  enviarAssinaturaAtivadaSeguro
};
