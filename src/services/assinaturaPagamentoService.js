const db = require("../db/db");
const pagamentoRepository = require(
  "../repositories/pagamentoRepository"
);
const assinaturaWebhookRepository = require(
  "../repositories/assinaturaWebhookRepository"
);
const {
  criarAssinaturaAsaas,
  removerAssinaturaAsaas,
} = require("./asaasService");
const {
  calcularProximaCobranca,
  normalizarFormaPagamento,
} = require("./assinaturaCalculos");

const STATUS_PAGAMENTO_VALIDO = new Set([
  "CONFIRMED",
  "RECEIVED",
  "RECEIVED_IN_CASH",
]);

const STATUS_REVERSAO_TOTAL = new Set([
  "REFUNDED",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL",
  "RECEIVED_IN_CASH_UNDONE",
]);

function dadosReversaoFinanceira(
  dadosPagamento,
  statusPagamento
) {
  const status = String(
    statusPagamento ||
    dadosPagamento?.status ||
    ""
  ).trim().toUpperCase();
  const tipoEvento = String(
    dadosPagamento?.webhookTipoEvento ||
    ""
  ).trim().toUpperCase();

  const parcial =
    status === "PARTIALLY_REFUNDED" ||
    tipoEvento === "PAYMENT_PARTIALLY_REFUNDED";

  const total =
    STATUS_REVERSAO_TOTAL.has(status) ||
    [
      "PAYMENT_REFUNDED",
      "PAYMENT_RECEIVED_IN_CASH_UNDONE",
      "PAYMENT_CHARGEBACK_REQUESTED",
      "PAYMENT_CHARGEBACK_DISPUTE",
      "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
    ].includes(tipoEvento);

  if (!parcial && !total) {
    if (
      STATUS_PAGAMENTO_VALIDO.has(status) ||
      tipoEvento === "PAYMENT_RESTORED"
    ) {
      return {
        limpar_reversao: true,
      };
    }

    return {};
  }

  const valorBruto =
    dadosPagamento?.refundedValue;
  const valorInformado =
    valorBruto === null ||
    valorBruto === undefined ||
    valorBruto === ""
      ? NaN
      : Number(valorBruto);
  const valorConhecido =
    total ||
    (
      Number.isFinite(valorInformado) &&
      valorInformado >= 0
    );

  const tipoReversao =
    parcial
      ? "PARTIALLY_REFUNDED"
      : tipoEvento.startsWith("PAYMENT_")
        ? tipoEvento.slice("PAYMENT_".length)
        : status;

  return {
    reversao_tipo:
      tipoReversao || null,
    reversao_em:
      dadosPagamento?.webhookEventoCriadoEm ||
      null,
    valor_revertido:
      parcial && valorConhecido
        ? valorInformado
        : null,
    reversao_valor_conhecido:
      valorConhecido,
  };
}

async function garantirPagamentoRecorrente(
  client,
  paymentId,
  dadosPagamento = {}
) {
  let assinatura = await assinaturaWebhookRepository
    .buscarPorPagamentoParaAtualizar(client, paymentId);

  if (assinatura) {
    return assinatura;
  }

  const subscriptionId = String(
    dadosPagamento.subscription || ""
  ).trim();

  if (!subscriptionId) {
    return null;
  }

  const assinaturaRecorrente = await assinaturaWebhookRepository
    .buscarPorSubscriptionParaAtualizar(
      client,
      subscriptionId
    );

  if (!assinaturaRecorrente) {
    return null;
  }

  assinatura = await assinaturaWebhookRepository
    .buscarPorPagamentoParaAtualizar(client, paymentId);

  if (assinatura) {
    return assinatura;
  }

  await pagamentoRepository.criarPagamento(client, {
    assinatura_id: assinaturaRecorrente.id,
    asaas_payment_id: paymentId,
    valor:
      dadosPagamento.value ?? assinaturaRecorrente.valor,
    forma_pagamento:
      normalizarFormaPagamento(dadosPagamento.billingType) ||
      assinaturaRecorrente.forma_pagamento,
    status: dadosPagamento.status || "PENDING",
    data_vencimento: dadosPagamento.dueDate || null,
    data_pagamento:
      dadosPagamento.paymentDate ||
      dadosPagamento.confirmedDate ||
      null,
    pix_copia_cola: null,
    pix_qrcode: null,
  });

  return assinaturaWebhookRepository
    .buscarPorPagamentoParaAtualizar(client, paymentId);
}

async function sincronizarPagamentoPorWebhook(
  dadosPagamento = {}
) {
  const paymentId = String(dadosPagamento.id || "").trim();

  if (!paymentId) {
    throw new Error("Pagamento não informado.");
  }

  return db.executarTransacao(async (client) => {
    const assinatura = await garantirPagamentoRecorrente(
      client,
      paymentId,
      dadosPagamento
    );

    if (!assinatura) {
      return null;
    }

    const status =
      dadosPagamento.status || "PENDING";

    return pagamentoRepository.atualizarStatusPagamento(
      client,
      paymentId,
      {
        status,
        data_pagamento:
          dadosPagamento.paymentDate ||
          dadosPagamento.confirmedDate ||
          null,
        evento_criado_em:
          dadosPagamento.webhookEventoCriadoEm || null,
        evento_id: dadosPagamento.webhookEventoId || null,
        ...dadosReversaoFinanceira(
          dadosPagamento,
          status
        ),
      }
    );
  });
}

async function suspenderAssinaturaPorPagamento(
  dadosPagamento = {}
) {
  const paymentId = String(dadosPagamento.id || "").trim();

  if (!paymentId) {
    throw new Error("Pagamento não informado.");
  }

  return db.executarTransacao(async (client) => {
    const assinatura = await garantirPagamentoRecorrente(
      client,
      paymentId,
      dadosPagamento
    );

    if (!assinatura) {
      return null;
    }

    const status = String(
      dadosPagamento.status || "OVERDUE"
    ).trim().toUpperCase();
    const pagamentoAtualizado = await pagamentoRepository
      .atualizarStatusPagamento(
        client,
        paymentId,
        {
          status,
          data_pagamento: null,
          evento_criado_em:
            dadosPagamento.webhookEventoCriadoEm || null,
          evento_id: dadosPagamento.webhookEventoId || null,
          ...dadosReversaoFinanceira(
            dadosPagamento,
            status
          ),
        }
      );

    if (!pagamentoAtualizado) {
      return null;
    }

    const planoGratis = await assinaturaWebhookRepository
      .buscarPlanoGratis(client);

    if (!planoGratis?.id) {
      throw new Error(
        "Plano gratuito não encontrado para suspender a assinatura."
      );
    }

    const suspensao = await assinaturaWebhookRepository
      .suspenderAssinatura(
        client,
        {
          assinaturaId: assinatura.id,
          status,
          observacao:
            "Acesso suspenso automaticamente após evento financeiro do Asaas.",
        }
      );

    await assinaturaWebhookRepository
      .atualizarPlanoNegocioSeSemOutraAssinatura(
        client,
        {
          negocioId: assinatura.negocio_id,
          planoAtualId: assinatura.plano_id,
          assinaturaIgnoradaId: assinatura.id,
          novoPlanoId: planoGratis.id,
        }
      );

    return suspensao;
  });
}

async function ativarAssinaturaPorPagamento(
  paymentId,
  statusPagamento = "CONFIRMED",
  dadosPagamento = {}
) {
  if (!paymentId) {
    throw new Error("Pagamento não informado.");
  }

  return db.executarTransacao(async (client) => {
    const assinatura = await garantirPagamentoRecorrente(
      client,
      paymentId,
      {
        ...dadosPagamento,
        status: statusPagamento || dadosPagamento.status,
      }
    );

    if (!assinatura) {
      return null;
    }

    const pagamentoAtualizado = await assinaturaWebhookRepository
      .confirmarPagamento(
        client,
        {
          pagamentoId: assinatura.pagamento_id,
          status: statusPagamento,
          eventoCriadoEm:
            dadosPagamento.webhookEventoCriadoEm || null,
          eventoId: dadosPagamento.webhookEventoId || null,
        }
      );

    if (!pagamentoAtualizado) {
      return null;
    }

    const assinaturaVigenteId = await assinaturaWebhookRepository
      .buscarAssinaturaVigenteMaisNova(
        client,
        assinatura.negocio_id,
        assinatura.id
      );

    if (assinaturaVigenteId) {
      return {
        ...assinatura,
        ativacao_ignorada: true,
        assinatura_vigente_id: assinaturaVigenteId,
      };
    }

    if (["CANCELED", "CANCELLED"].includes(
      String(assinatura.status || "").trim().toUpperCase()
    )) {
      return assinatura;
    }

    let asaasSubscriptionId = assinatura.asaas_subscription_id;
    let dataProximaCobranca = assinatura.data_proxima_cobranca;
    let novaRecorrencia = false;

    if (
      assinatura.forma_pagamento === "pix" &&
      !asaasSubscriptionId
    ) {
      dataProximaCobranca = calcularProximaCobranca(
        assinatura.data_pagamento ||
        assinatura.data_vencimento ||
        new Date()
      );

      const assinaturaAsaas = await criarAssinaturaAsaas({
        customerId: assinatura.asaas_customer_id,
        valor: assinatura.valor,
        descricao: "Agenda Fashion - Assinatura mensal",
        formaPagamento: "pix",
        externalReference:
          `assinatura:${assinatura.id};` +
          `negocio:${assinatura.negocio_id};` +
          `plano:${assinatura.plano_id}`,
        proximaCobranca: dataProximaCobranca,
        reutilizarPorExternalReference: true,
      });

      if (!assinaturaAsaas?.id) {
        throw new Error(
          "O Asaas não retornou o identificador da assinatura."
        );
      }

      asaasSubscriptionId = assinaturaAsaas.id;
      novaRecorrencia = true;
      dataProximaCobranca =
        assinaturaAsaas.nextDueDate || dataProximaCobranca;
    } else if (
      assinatura.asaas_subscription_id &&
      (
        dadosPagamento.paymentDate ||
        dadosPagamento.confirmedDate ||
        dadosPagamento.dueDate
      )
    ) {
      dataProximaCobranca = calcularProximaCobranca(
        dadosPagamento.paymentDate ||
        dadosPagamento.confirmedDate ||
        dadosPagamento.dueDate
      );
    }

    if (novaRecorrencia) {
      const anteriores = await assinaturaWebhookRepository
        .listarAtivasAnteriores(
          client,
          assinatura.negocio_id,
          assinatura.id
        );
      const recorrencias = new Set(
        anteriores
          .map((item) => String(
            item.asaas_subscription_id || ""
          ).trim())
          .filter(
            (id) => id && id !== asaasSubscriptionId
          )
      );

      for (const recorrenciaId of recorrencias) {
        await removerAssinaturaAsaas(recorrenciaId);
      }

      await assinaturaWebhookRepository
        .cancelarAtivasSubstituidas(
          client,
          assinatura.negocio_id,
          assinatura.id
        );
    }

    await assinaturaWebhookRepository.desativarOutras(
      client,
      assinatura.negocio_id,
      assinatura.id
    );

    const ativacao = await assinaturaWebhookRepository
      .ativarAssinatura(
        client,
        {
          assinaturaId: assinatura.id,
          subscriptionId: asaasSubscriptionId || null,
          proximaCobranca: dataProximaCobranca || null,
          observacoes: asaasSubscriptionId
            ? "Assinatura mensal ativa no Asaas."
            : assinatura.observacoes,
        }
      );

    await assinaturaWebhookRepository.atualizarPlanoNegocio(
      client,
      assinatura.negocio_id,
      assinatura.plano_id
    );

    return ativacao;
  });
}

module.exports = {
  sincronizarPagamentoPorWebhook,
  suspenderAssinaturaPorPagamento,
  ativarAssinaturaPorPagamento,
};
