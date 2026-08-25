const googleMeasurementRepository = require(
  "../repositories/googleMeasurementRepository"
);
const registrador = require(
  "../utils/registrador"
);

const DEFAULT_TIMEOUT_MS = 1800;
const GOOGLE_CONSENT_SOURCE =
  "NAVEGADOR";
const GOOGLE_CONSENT_TEXT_VERSION =
  "2026-08-25";
const GOOGLE_LEGACY_CONSENT_TEXT_VERSION =
  "legado-sem-versao";

function normalizarTexto(valor) {
  return String(valor ?? "").trim();
}

function flagAtiva(valor) {
  return ["1", "true", "yes", "sim", "on"].includes(
    normalizarTexto(valor).toLowerCase()
  );
}

function obterMeasurementId() {
  const valor = normalizarTexto(
    process.env.GA4_MEASUREMENT_ID
  ).toUpperCase();

  return /^G-[A-Z0-9]{6,20}$/.test(valor)
    ? valor
    : "";
}

function obterAdsId() {
  const valor = normalizarTexto(
    process.env.GOOGLE_ADS_ID
  ).toUpperCase();

  return /^AW-\d{5,20}$/.test(valor)
    ? valor
    : "";
}

function normalizarLabel(valor) {
  const texto = normalizarTexto(valor);

  return /^[A-Za-z0-9_-]{4,100}$/.test(texto)
    ? texto
    : "";
}

function obterTimeoutMs() {
  const valor = Number(
    process.env.GOOGLE_MEASUREMENT_TIMEOUT_MS
  );

  return Number.isInteger(valor) &&
    valor >= 500 &&
    valor <= 5000
    ? valor
    : DEFAULT_TIMEOUT_MS;
}

function googleHabilitado() {
  return flagAtiva(
    process.env.GOOGLE_MEASUREMENT_ENABLED
  ) && Boolean(obterMeasurementId());
}

function measurementProtocolHabilitado() {
  return googleHabilitado() && Boolean(
    normalizarTexto(
      process.env.GA4_API_SECRET
    )
  );
}

function obterConfiguracaoPublica() {
  const enabled = googleHabilitado();
  const adsId = enabled
    ? obterAdsId()
    : "";

  return {
    enabled,
    measurementId: enabled
      ? obterMeasurementId()
      : null,
    adsId: adsId || null,
    signUpLabel:
      adsId
        ? normalizarLabel(
            process.env.GOOGLE_ADS_SIGNUP_LABEL
          ) || null
        : null,
    beginCheckoutLabel:
      adsId
        ? normalizarLabel(
            process.env.GOOGLE_ADS_CHECKOUT_LABEL
          ) || null
        : null
  };
}

function normalizarClientId(valor) {
  const texto = normalizarTexto(valor);

  if (
    texto.length < 4 ||
    texto.length > 120 ||
    !/^[A-Za-z0-9._-]+$/.test(texto)
  ) {
    return null;
  }

  return texto;
}

function sanitizarContextoCliente(google) {
  const consentimento =
    google?.consentimento === true;
  const textoVersao =
    normalizarTexto(google?.texto_versao) ===
      GOOGLE_CONSENT_TEXT_VERSION
      ? GOOGLE_CONSENT_TEXT_VERSION
      : GOOGLE_LEGACY_CONSENT_TEXT_VERSION;

  return {
    consentimento,
    clientId: consentimento
      ? normalizarClientId(
          google?.client_id
        )
      : null,
    textoVersao
  };
}

async function salvarConsentimento({
  usuarioId,
  google
}) {
  const contexto =
    sanitizarContextoCliente(google);

  if (!usuarioId) {
    return null;
  }

  return googleMeasurementRepository
    .salvarConsentimentoUsuario({
      usuarioId,
      consentido:
        contexto.consentimento,
      clientId:
        contexto.clientId,
      origem:
        GOOGLE_CONSENT_SOURCE,
      textoVersao:
        contexto.textoVersao
    });
}

async function enviarEventoMeasurementProtocol({
  clientId,
  userId,
  eventName,
  params
}) {
  if (!measurementProtocolHabilitado()) {
    return {
      enviado: false,
      motivo: "desabilitado"
    };
  }

  const clientIdNormalizado =
    normalizarClientId(clientId);

  if (!clientIdNormalizado) {
    return {
      enviado: false,
      motivo: "client_id_invalido"
    };
  }

  const payload = {
    client_id: clientIdNormalizado,
    ...(userId
      ? { user_id: String(userId) }
      : {}),
    events: [
      {
        name: String(eventName || "").trim(),
        params: {
          ...(params || {}),
          engagement_time_msec: 1
        }
      }
    ]
  };

  const query =
    new URLSearchParams({
      measurement_id:
        obterMeasurementId(),
      api_secret:
        normalizarTexto(
          process.env.GA4_API_SECRET
        )
    });
  const endpoint =
    `https://www.google-analytics.com/mp/collect?${query.toString()}`;
  const controller =
    new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    obterTimeoutMs()
  );

  try {
    const response = await fetch(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      const erro = new Error(
        "Google Analytics rejeitou o evento do Measurement Protocol."
      );
      erro.status = response.status;
      throw erro;
    }

    return {
      enviado: true
    };
  } finally {
    clearTimeout(timeout);
  }
}

function registrarFalha(evento, erro) {
  registrador.aviso(
    "[Google Measurement] Falha ao enviar evento. O fluxo do produto foi preservado.",
    {
      evento,
      status: erro?.status || null,
      erro:
        erro?.name === "AbortError"
          ? "timeout"
          : erro?.message
    }
  );
}

function dispararSeguro(evento, tarefa) {
  void Promise.resolve()
    .then(tarefa)
    .catch((erro) => {
      registrarFalha(evento, erro);
    });
}

function enviarAssinaturaAtivadaSeguro({
  negocioId,
  assinaturaId,
  pagamentoId,
  valor
}) {
  if (
    !measurementProtocolHabilitado() ||
    !negocioId ||
    !assinaturaId ||
    !pagamentoId
  ) {
    return;
  }

  dispararSeguro(
    "purchase",
    async () => {
      const primeiroPagamento =
        await googleMeasurementRepository
          .ehPrimeiroPagamentoAssinatura({
            assinaturaId,
            pagamentoId
          });

      if (!primeiroPagamento) {
        return {
          enviado: false,
          motivo: "renovacao"
        };
      }

      const perfil =
        await googleMeasurementRepository
          .buscarPerfilPorNegocio(
            negocioId
          );

      if (
        perfil?.google_consentimento_status !== true ||
        !perfil?.google_consentido_em ||
        perfil?.google_revogado_em ||
        !perfil?.google_client_id
      ) {
        return {
          enviado: false,
          motivo: "sem_consentimento"
        };
      }

      const valorNumerico =
        Number(valor || 0);

      return enviarEventoMeasurementProtocol({
        clientId:
          perfil.google_client_id,
        userId:
          perfil.usuario_id,
        eventName: "purchase",
        params: {
          transaction_id:
            `af-subscription-${assinaturaId}`,
          currency: "BRL",
          value:
            Number.isFinite(valorNumerico)
              ? valorNumerico
              : 0,
          items: [
            {
              item_id:
                "agenda-fashion-subscription",
              item_name:
                "Assinatura Agenda Fashion",
              price:
                Number.isFinite(valorNumerico)
                  ? valorNumerico
                  : 0,
              quantity: 1
            }
          ]
        }
      });
    }
  );
}

module.exports = {
  obterConfiguracaoPublica,
  sanitizarContextoCliente,
  salvarConsentimento,
  enviarEventoMeasurementProtocol,
  enviarAssinaturaAtivadaSeguro
};
