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
const {
  reconciliarLimiteProfissionais,
} = require("./equipePlanoService");
const assinaturaLifecycleService = require(
  "./assinaturaLifecycleService"
);

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
    invoice_url:
      dadosPagamento.invoiceUrl || null,
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

    const statusPagamento = String(
      dadosPagamento.status || "PENDING"
    ).trim().toUpperCase();

    const atualizacaoPagamento = {
      status: statusPagamento,
      data_pagamento:
        dadosPagamento.paymentDate ||
        dadosPagamento.confirmedDate ||
        null,
      evento_criado_em:
        dadosPagamento.webhookEventoCriadoEm || null,
      evento_id: dadosPagamento.webhookEventoId || null,
    };

    if (dadosPagamento.invoiceUrl) {
      atualizacaoPagamento.invoice_url =
        dadosPagamento.invoiceUrl;
    }

    const pagamentoAtualizado =
      await pagamentoRepository.atualizarStatusPagamento(
        client,
        paymentId,
        atualizacaoPagamento
      );

    if (!pagamentoAtualizado) {
      return null;
    }

    const checkoutInicialPendente =
      assinatura.ativo !== true &&
      !assinatura.asaas_subscription_id &&
      ["PENDING", "PENDING_PAYMENT"].includes(
        String(assinatura.status || "")
          .trim()
          .toUpperCase()
      );

    if (
      checkoutInicialPendente &&
      ["DELETED", "CANCELED", "CANCELLED", "EXPIRED"].includes(
        statusPagamento
      )
    ) {
      await assinaturaWebhookRepository
        .encerrarAssinaturaPendente(
          client,
          {
            assinaturaId: assinatura.id,
            status: statusPagamento,
            observacao:
              "Checkout inicial encerrado após falha definitiva ou expiração da cobrança.",
          }
        );
    }

    return pagamentoAtualizado;
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
    const atualizacaoPagamento = {
      status,
      data_pagamento: null,
      evento_criado_em:
        dadosPagamento.webhookEventoCriadoEm || null,
      evento_id: dadosPagamento.webhookEventoId || null,
    };

    if (dadosPagamento.invoiceUrl) {
      atualizacaoPagamento.invoice_url =
        dadosPagamento.invoiceUrl;
    }

    const pagamentoAtualizado = await pagamentoRepository
      .atualizarStatusPagamento(
        client,
        paymentId,
        atualizacaoPagamento
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

    await reconciliarLimiteProfissionais(
      assinatura.negocio_id,
      client
    );

    await assinaturaLifecycleService.registrarAtraso({
      client,
      assinatura,
      pagamentoId: assinatura.pagamento_id,
      status,
      ocorridoEm:
        dadosPagamento.webhookEventoCriadoEm || null,
    });

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
          invoiceUrl: dadosPagamento.invoiceUrl || null,
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

    await assinaturaLifecycleService
      .registrarConfirmacaoPagamento({
        client,
        assinatura,
        pagamentoId: assinatura.pagamento_id,
        asaasPaymentId: paymentId,
        ocorridoEm:
          dadosPagamento.webhookEventoCriadoEm || null,
      });

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
