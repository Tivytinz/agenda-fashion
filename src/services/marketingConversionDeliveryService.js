const marketingConversionDeliveryRepository = require(
  "../repositories/marketingConversionDeliveryRepository"
);
const marketingConversaoRepository = require(
  "../repositories/marketingConversaoRepository"
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
const REPLAY_INTEGRACAO_MAX_HORAS = 72;

let processamentoFilaAtual = null;

function normalizarTimestamp(valor) {
  if (!valor) {
    return null;
  }

  const data =
    valor instanceof Date
      ? valor
      : new Date(valor);

  return Number.isFinite(data.getTime())
    ? data.toISOString()
    : null;
}

function normalizarPayload(dados = {}) {
  return {
    negocioId:
      Number(dados.negocioId) || null,
    assinaturaId:
      Number(dados.assinaturaId) || null,
    pagamentoId:
      String(dados.pagamentoId || "").trim() || null,
    pagamentoInternoId:
      Number(dados.pagamentoInternoId) || null,
    assinaturaEventoId:
      Number(dados.assinaturaEventoId) || null,
    usuarioAquisicaoId:
      Number(dados.usuarioAquisicaoId) || null,
    ocorridoEm:
      normalizarTimestamp(dados.ocorridoEm),
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
  const entrada =
    normalizarPayload(dados);

  if (!validarPayload(entrada)) {
    throw new Error(
      "Conversão de assinatura sem identificadores obrigatórios."
    );
  }

  const conversao =
    await marketingConversaoRepository
      .buscarConversaoInicialConfirmada({
        assinaturaId:
          entrada.assinaturaId,
        pagamentoId:
          entrada.pagamentoId
      });

  if (!conversao) {
    return [];
  }

  const payload =
    normalizarPayload({
      negocioId:
        conversao.negocio_id,
      assinaturaId:
        conversao.assinatura_id,
      pagamentoId:
        conversao.asaas_payment_id,
      pagamentoInternoId:
        conversao.pagamento_interno_id,
      assinaturaEventoId:
        conversao.assinatura_evento_id,
      usuarioAquisicaoId:
        conversao.usuario_aquisicao_id,
      ocorridoEm:
        conversao
          .confirmacao_observada_em ||
        conversao.ocorrido_em ||
        conversao.data_pagamento,
      valor:
        conversao.valor
    });

  return Promise.all([
    marketingConversionDeliveryRepository
      .enfileirar({
        provedor: "meta",
        tipoEvento:
          TIPO_ASSINATURA_ATIVADA,
        assinaturaEventoId:
          payload.assinaturaEventoId,
        ocorridoEm:
          payload.ocorridoEm,
        payload
      }),
    marketingConversionDeliveryRepository
      .enfileirar({
        provedor: "google",
        tipoEvento:
          TIPO_ASSINATURA_ATIVADA,
        assinaturaEventoId:
          payload.assinaturaEventoId,
        ocorridoEm:
          payload.ocorridoEm,
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

    throw erro;
  }
}

async function buscarPagamentoConfirmado(
  payload
) {
  const pagamento =
    await marketingConversaoRepository
      .buscarPagamentoConfirmado({
        assinaturaId:
          payload.assinaturaId,
        pagamentoId:
          payload.pagamentoId
      });

  if (!pagamento) {
    throw new Error(
      "Pagamento confirmado não encontrado para entregar a conversão."
    );
  }

  const valor =
    Number(pagamento.valor);

  return {
    ...pagamento,
    valor:
      Number.isFinite(valor)
        ? valor
        : 0
  };
}

async function validarConversaoInicial(
  payload
) {
  const conversao =
    await marketingConversaoRepository
      .buscarConversaoInicialConfirmada({
        assinaturaId:
          payload.assinaturaId,
        pagamentoId:
          payload.pagamentoId
      });

  if (!conversao) {
    return null;
  }

  if (
    payload.assinaturaEventoId &&
    Number(conversao.assinatura_evento_id) !==
      Number(payload.assinaturaEventoId)
  ) {
    return null;
  }

  if (
    payload.negocioId &&
    Number(conversao.negocio_id) !==
      Number(payload.negocioId)
  ) {
    return null;
  }

  return conversao;
}

async function entregarMeta(payload) {
  const conversao =
    await validarConversaoInicial(
      payload
    );

  if (!conversao) {
    return {
      enviado: false,
      motivo: "nao_conversao_inicial"
    };
  }

  const pagamento =
    await buscarPagamentoConfirmado(
      payload
    );

  const perfil =
    payload.usuarioAquisicaoId
      ? await metaAdsRepository
          .buscarPerfilPorUsuario(
            payload.usuarioAquisicaoId
          )
      : await metaAdsRepository
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
    ...metaAdsService
      .sanitizarContextoCliente({
        consentimento: true,
        event_id:
          `subscribe:${payload.assinaturaId}`,
        fbp:
          perfil.meta_fbp || null,
        fbc:
          perfil.meta_fbc || null,
        source_url:
          "/painel/assinatura"
      }),
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
    ocorridoEm:
      pagamento
        .confirmacao_observada_em ||
      payload.ocorridoEm ||
      pagamento.data_pagamento,
    customData: {
      currency: "BRL",
      value:
        pagamento.valor,
      content_name:
        "Assinatura Agenda Fashion"
    }
  });
}

async function entregarGoogle(payload) {
  const conversao =
    await validarConversaoInicial(
      payload
    );

  if (!conversao) {
    return {
      enviado: false,
      motivo: "nao_conversao_inicial"
    };
  }

  const pagamento =
    await buscarPagamentoConfirmado(
      payload
    );

  const perfil =
    payload.usuarioAquisicaoId
      ? await googleMeasurementRepository
          .buscarPerfilPorUsuario(
            payload.usuarioAquisicaoId
          )
      : await googleMeasurementRepository
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

  return googleMeasurementService
    .enviarEventoMeasurementProtocol({
      clientId:
        perfil.google_client_id,
      userId:
        perfil.usuario_id,
      eventName: "purchase",
      ocorridoEm:
        pagamento
          .confirmacao_observada_em ||
        payload.ocorridoEm ||
        pagamento.data_pagamento,
      params: {
        transaction_id:
          `af-subscription-${payload.assinaturaId}`,
        currency: "BRL",
        value:
          pagamento.valor,
        items: [
          {
            item_id:
              "agenda-fashion-subscription",
            item_name:
              "Assinatura Agenda Fashion",
            price:
              pagamento.valor,
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

const MOTIVOS_IGNORADOS = new Map([
  [
    "sem_consentimento",
    "SEM_CONSENTIMENTO"
  ]
]);

const MOTIVOS_FALHA_TERMINAL = new Map([
  [
    "desabilitado",
    "INTEGRACAO_DESABILITADA"
  ],
  [
    "nao_conversao_inicial",
    "DIVERGENCIA_FINANCEIRA"
  ],
  [
    "event_id_invalido",
    "EVENT_ID_INVALIDO"
  ],
  [
    "client_id_invalido",
    "CLIENT_ID_INVALIDO"
  ],
  [
    "provedor_desconhecido",
    "PROVEDOR_DESCONHECIDO"
  ]
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

function contextoLog(entrega) {
  return {
    entrega_id:
      entrega?.id || null,
    provedor:
      entrega?.provedor || null,
    tentativa:
      entrega?.lease_tentativa ??
      entrega?.tentativas ??
      null
  };
}

async function registrarFalhaTerminal(
  entrega,
  motivo,
  resultadoCodigo =
    "FALHA_TECNICA"
) {
  await finalizarComLease(
    () =>
      marketingConversionDeliveryRepository
        .marcarFalhaTerminal(
          entrega.id,
          entrega.lease_tentativa,
          motivo,
          resultadoCodigo
        ),
    entrega
  );

  registrador.aviso(
    "Conversão de assinatura: falha terminal na entrega.",
    {
      ...contextoLog(entrega),
      erro: motivo
    }
  );
}

async function processarRegistro(entrega) {
  const executor =
    executorProvedor(
      entrega.provedor
    );

  if (!executor) {
    await registrarFalhaTerminal(
      entrega,
      "provedor_desconhecido",
      "PROVEDOR_DESCONHECIDO"
    );

    return {
      enviado: false,
      ignorado: false,
      falhaTerminal: true,
      motivo: "provedor_desconhecido"
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

    if (MOTIVOS_IGNORADOS.has(motivo)) {
      await finalizarComLease(
        () =>
          marketingConversionDeliveryRepository
            .marcarIgnorado(
              entrega.id,
              entrega.lease_tentativa,
              motivo,
              MOTIVOS_IGNORADOS.get(motivo)
            ),
        entrega
      );

      return {
        enviado: false,
        ignorado: true,
        motivo
      };
    }

    if (
      MOTIVOS_FALHA_TERMINAL
        .has(motivo)
    ) {
      await registrarFalhaTerminal(
        entrega,
        motivo,
        MOTIVOS_FALHA_TERMINAL
          .get(motivo)
      );

      return {
        enviado: false,
        ignorado: false,
        falhaTerminal: true,
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
        contextoLog(entrega)
      );

      throw erro;
    }

    await finalizarComLease(
      () =>
        marketingConversionDeliveryRepository
          .marcarFalha(
            entrega.id,
            entrega.lease_tentativa,
            erro?.message ||
              "Falha desconhecida"
          ),
      entrega
    );

    registrador.aviso(
      "Conversão de assinatura: falha temporária na entrega.",
      {
        ...contextoLog(entrega),
        erro:
          erro?.name === "AbortError"
            ? "timeout"
            : erro?.message
      }
    );

    throw erro;
  }
}

async function rearmarIntegracoesRestauradas() {
  const provedores = [];

  if (
    typeof metaAdsService
      .serverSideHabilitado === "function" &&
    metaAdsService
      .serverSideHabilitado()
  ) {
    provedores.push("meta");
  }

  if (
    typeof googleMeasurementService
      .serverSideHabilitado === "function" &&
    googleMeasurementService
      .serverSideHabilitado()
  ) {
    provedores.push("google");
  }

  let total = 0;

  for (const provedor of provedores) {
    const rearmadas =
      await marketingConversionDeliveryRepository
        .rearmarIntegracaoDisponivel(
          provedor,
          REPLAY_INTEGRACAO_MAX_HORAS
        );

    if (rearmadas?.length) {
      total += rearmadas.length;

      registrador.informacao(
        "Conversões de marketing: entregas rearmadas após restauração da integração.",
        {
          provedor,
          entregas:
            rearmadas.length
        }
      );
    }
  }

  return total;
}

async function executarFilaConversoes(
  limite
) {
  let processados = 0;

  await rearmarIntegracoesRestauradas();

  const esgotados =
    await marketingConversionDeliveryRepository
      .marcarProcessamentosEsgotados();

  for (const entrega of esgotados || []) {
    registrador.aviso(
      "Conversão de assinatura: tentativas esgotadas.",
      {
        entrega_id:
          entrega.id,
        provedor:
          entrega.provedor,
        tentativa:
          entrega.tentativas,
        erro:
          entrega.ultimo_erro || null
      }
    );
  }

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

function processarFilaConversoes(
  limite = 20
) {
  if (processamentoFilaAtual) {
    return processamentoFilaAtual;
  }

  processamentoFilaAtual =
    executarFilaConversoes(limite)
      .finally(() => {
        processamentoFilaAtual = null;
      });

  return processamentoFilaAtual;
}

module.exports = {
  enfileirarAssinaturaAtivada,
  enfileirarAssinaturaAtivadaSeguro,
  processarFilaConversoes
};
