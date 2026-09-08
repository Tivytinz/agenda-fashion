const marketingConversionDeliveryRepository = require(
  "../repositories/marketingConversionDeliveryRepository"
);
const metaAdsRepository = require(
  "../repositories/metaAdsRepository"
);
const googleMeasurementRepository = require(
  "../repositories/googleMeasurementRepository"
);
const metaAdsService = require(
  "./metaAdsService"
);
const googleMeasurementService = require(
  "./googleMeasurementService"
);
const registrador = require(
  "../utils/registrador"
);

const TIPO_ASSINATURA_ATIVADA =
  "SUBSCRIPTION_ACTIVATED";

function normalizarPayload(dados = {}) {
  return {
    negocioId:
      Number(dados.negocioId) || null,
    assinaturaId:
      Number(dados.assinaturaId) || null,
    pagamentoId:
      String(dados.pagamentoId || "").trim() || null,
    valor:
      Number.isFinite(Number(dados.valor))
        ? Number(dados.valor)
        : 0
  };
}

function validarPayload(payload) {
  return Boolean(
    payload.negocioId &&
    payload.assinaturaId &&
    payload.pagamentoId
  );
}

async function enfileirarAssinaturaAtivada(
  dados
) {
  const payload =
    normalizarPayload(dados);

  if (!validarPayload(payload)) {
    throw new Error(
      "Conversão de assinatura sem identificadores obrigatórios."
    );
  }

  const chaveEvento =
    `assinatura:${payload.assinaturaId}`;

  return Promise.all([
    marketingConversionDeliveryRepository
      .enfileirar({
        provedor: "meta",
        tipoEvento:
          TIPO_ASSINATURA_ATIVADA,
        chaveEvento,
        payload
      }),
    marketingConversionDeliveryRepository
      .enfileirar({
        provedor: "google",
        tipoEvento:
          TIPO_ASSINATURA_ATIVADA,
        chaveEvento,
        payload
      })
  ]);
}

async function enfileirarAssinaturaAtivadaSeguro(
  dados
) {
  try {
    return await enfileirarAssinaturaAtivada(
      dados
    );
  } catch (erro) {
    registrador.aviso(
      "Conversão de assinatura: falha ao persistir entrega.",
      {
        assinatura_id:
          dados?.assinaturaId || null,
        pagamento_id:
          dados?.pagamentoId || null,
        erro:
          erro?.message ||
          "Falha desconhecida"
      }
    );

    return [];
  }
}

async function entregarMeta(payload) {
  const primeiroPagamento =
    await metaAdsRepository
      .ehPrimeiroPagamentoAssinatura({
        assinaturaId:
          payload.assinaturaId,
        pagamentoId:
          payload.pagamentoId
      });

  if (!primeiroPagamento) {
    return {
      enviado: false,
      motivo: "renovacao"
    };
  }

  const perfil =
    await metaAdsRepository
      .buscarPerfilPorNegocio(
        payload.negocioId
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
      `subscribe:${payload.assinaturaId}`,
    fbp:
      perfil.meta_fbp || null,
    fbc:
      perfil.meta_fbc || null,
    sourceUrl:
      "/painel/assinatura",
    clientIp: null,
    userAgent: null
  };

  return metaAdsService.enviarEvento({
    eventName: "Subscribe",
    eventId:
      contexto.eventId,
    usuarioId:
      perfil.usuario_id,
    email:
      perfil.email,
    whatsapp:
      perfil.whatsapp,
    contexto,
    perfil,
    customData: {
      currency: "BRL",
      value:
        Number(payload.valor || 0),
      content_name:
        "Assinatura Agenda Fashion"
    }
  });
}

async function entregarGoogle(payload) {
  const primeiroPagamento =
    await googleMeasurementRepository
      .ehPrimeiroPagamentoAssinatura({
        assinaturaId:
          payload.assinaturaId,
        pagamentoId:
          payload.pagamentoId
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
        payload.negocioId
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

  const valor =
    Number(payload.valor || 0);
  const valorSeguro =
    Number.isFinite(valor)
      ? valor
      : 0;

  return googleMeasurementService
    .enviarEventoMeasurementProtocol({
      clientId:
        perfil.google_client_id,
      userId:
        perfil.usuario_id,
      eventName: "purchase",
      params: {
        transaction_id:
          `af-subscription-${payload.assinaturaId}`,
        currency: "BRL",
        value:
          valorSeguro,
        items: [
          {
            item_id:
              "agenda-fashion-subscription",
            item_name:
              "Assinatura Agenda Fashion",
            price:
              valorSeguro,
            quantity: 1
          }
        ]
      }
    });
}

function executorProvedor(provedor) {
  if (provedor === "meta") {
    return entregarMeta;
  }

  if (provedor === "google") {
    return entregarGoogle;
  }

  return null;
}

const MOTIVOS_TERMINAIS = new Set([
  "renovacao",
  "sem_consentimento",
  "desabilitado",
  "event_id_invalido",
  "client_id_invalido"
]);

function criarErroLeasePerdido(entrega) {
  const erro = new Error(
    "Lease da entrega de conversão não é mais válido."
  );
  erro.code =
    "MARKETING_CONVERSION_LEASE_LOST";
  erro.entregaId =
    entrega?.id || null;
  return erro;
}

async function finalizarComLease(
  tarefa,
  entrega
) {
  const atualizado =
    await tarefa();

  if (!atualizado) {
    throw criarErroLeasePerdido(
      entrega
    );
  }

  return atualizado;
}

async function processarRegistro(entrega) {
  const executor =
    executorProvedor(
      entrega.provedor
    );

  if (!executor) {
    await finalizarComLease(
      () =>
        marketingConversionDeliveryRepository
          .marcarIgnorado(
            entrega.id,
            entrega.lease_tentativa,
            "provedor_desconhecido"
          ),
      entrega
    );

    return {
      enviado: false,
      ignorado: true
    };
  }

  try {
    const resultado =
      await executor(
        entrega.payload || {}
      );

    if (resultado?.enviado === true) {
      await finalizarComLease(
        () =>
          marketingConversionDeliveryRepository
            .marcarEnviado(
              entrega.id,
              entrega.lease_tentativa
            ),
        entrega
      );

      return {
        enviado: true,
        ignorado: false
      };
    }

    const motivo =
      String(
        resultado?.motivo || ""
      ).trim();

    if (MOTIVOS_TERMINAIS.has(motivo)) {
      await finalizarComLease(
        () =>
          marketingConversionDeliveryRepository
            .marcarIgnorado(
              entrega.id,
              entrega.lease_tentativa,
              motivo
            ),
        entrega
      );

      return {
        enviado: false,
        ignorado: true,
        motivo
      };
    }

    throw new Error(
      `Entrega da conversão sem confirmação do provedor${
        motivo
          ? `: ${motivo}`
          : "."
      }`
    );
  } catch (erro) {
    if (
      erro?.code ===
      "MARKETING_CONVERSION_LEASE_LOST"
    ) {
      registrador.aviso(
        "Conversão de assinatura: lease perdido durante a finalização.",
        {
          entrega_id:
            entrega.id,
          provedor:
            entrega.provedor,
          tentativa:
            entrega.lease_tentativa
        }
      );

      throw erro;
    }

    await marketingConversionDeliveryRepository
      .marcarFalha(
        entrega.id,
        entrega.lease_tentativa,
        erro?.message ||
          "Falha desconhecida"
      );

    registrador.aviso(
      "Conversão de assinatura: falha temporária na entrega.",
      {
        entrega_id:
          entrega.id,
        provedor:
          entrega.provedor,
        tentativa:
          entrega.lease_tentativa,
        erro:
          erro?.name === "AbortError"
            ? "timeout"
            : erro?.message
      }
    );

    throw erro;
  }
}

async function processarFilaConversoes(
  limite = 20
) {
  let processados = 0;

  await marketingConversionDeliveryRepository
    .marcarProcessamentosEsgotados();

  while (processados < limite) {
    const entrega =
      await marketingConversionDeliveryRepository
        .reservarProximo();

    if (!entrega) {
      break;
    }

    await processarRegistro(entrega)
      .catch(() => {});

    processados += 1;
  }

  return processados;
}

module.exports = {
  enfileirarAssinaturaAtivada,
  enfileirarAssinaturaAtivadaSeguro,
  processarFilaConversoes
};
