const db = require("../db/db");
const renovacaoRepository = require("../repositories/assinaturaRenovacaoRepository");
const checkoutRepository = require("../repositories/assinaturaCheckoutRepository");
const assinaturaWebhookRepository = require(
  "../repositories/assinaturaWebhookRepository"
);
const {
  acessoPagoAindaValido,
  extrairReferenciaAssinatura,
  normalizarFormaPagamento,
} = require("./assinaturaCalculos");
const {
  reconciliarLimiteProfissionais,
} = require("./equipePlanoService");
const assinaturaLifecycleService = require(
  "./assinaturaLifecycleService"
);

async function localizarAssinaturaPorWebhook(
  client,
  subscriptionId,
  externalReference
) {
  const porSubscription = await assinaturaWebhookRepository
    .buscarPorSubscriptionParaAtualizar(
      client,
      subscriptionId
    );

  if (porSubscription) {
    return porSubscription;
  }

  const referencia = extrairReferenciaAssinatura(
    externalReference
  );

  if (!referencia.assinatura) {
    return null;
  }

  const assinatura = await assinaturaWebhookRepository
    .buscarPorReferenciaParaAtualizar(
      client,
      referencia.assinatura,
      subscriptionId
    );

  if (
    !assinatura ||
    (
      referencia.negocio &&
      referencia.negocio !== assinatura.negocio_id
    ) ||
    (
      referencia.plano &&
      referencia.plano !== assinatura.plano_id
    )
  ) {
    return null;
  }

  return assinatura;
}

async function sincronizarAssinaturaPorWebhook(
  tipoEvento,
  dadosAssinatura = {}
) {
  const subscriptionId = String(
    dadosAssinatura.id || ""
  ).trim();

  if (!subscriptionId) {
    throw new Error("Assinatura não informada.");
  }

  const eventos = new Set([
    "SUBSCRIPTION_CREATED",
    "SUBSCRIPTION_UPDATED",
    "SUBSCRIPTION_INACTIVATED",
    "SUBSCRIPTION_DELETED",
  ]);

  if (!eventos.has(tipoEvento)) {
    return null;
  }

  return db.executarTransacao(async (client) => {
    const referencia = extrairReferenciaAssinatura(dadosAssinatura.externalReference);
    await assinaturaWebhookRepository.bloquearNegocioDoEvento(client, {
      subscriptionId, assinaturaId: referencia.assinatura || null,
      externalReference: dadosAssinatura.externalReference || null,
    });
    if (["SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED"].includes(tipoEvento) && dadosAssinatura.customer) {
      const checkout = await checkoutRepository.registrarWebhook(client, {
        externalReference: dadosAssinatura.externalReference || null,
        customerId: dadosAssinatura.customer, subscriptionId,
      });
      // Não vincular nem conceder benefícios por um evento de programação.
      // Mesmo uma resposta tardia após consulta de ausência reabre a remoção.
      if (checkout && checkout.estado !== "COMPLETED") return null;
    }
    if (["SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED"].includes(tipoEvento) &&
      String(dadosAssinatura.externalReference || "").startsWith("assinatura-reativada:") && dadosAssinatura.customer) {
      await renovacaoRepository.registrarRecorrenciaRecebida(client, {
        externalReference: dadosAssinatura.externalReference, customerId: dadosAssinatura.customer,
        subscriptionId,
      });
    }
    const assinatura = await localizarAssinaturaPorWebhook(
      client,
      subscriptionId,
      dadosAssinatura.externalReference
    );

    if (!assinatura) {
      return null;
    }

    // Enquanto a tentativa está reservada, este ID ainda é o da recorrência
    // anterior. Seu reconhecimento tardio não conclui nem desfaz a reativação.
    if (String(assinatura.status).toUpperCase() === "REACTIVATING" ||
      await renovacaoRepository.possuiPendenteDaAssinatura(assinatura.id, client)) return null;

    const eventoEncerramento = [
      "SUBSCRIPTION_INACTIVATED",
      "SUBSCRIPTION_DELETED",
    ].includes(tipoEvento) || (tipoEvento === "SUBSCRIPTION_UPDATED" &&
      String(dadosAssinatura.status).toUpperCase() === "INACTIVE");
    const manterPeriodoPago =
      eventoEncerramento &&
      acessoPagoAindaValido(assinatura);

    let status = assinatura.status;

    if (manterPeriodoPago) {
      status = "CANCELED";
    } else if (eventoEncerramento && !["REFUNDED", "RECEIVED_IN_CASH_UNDONE", "CHARGEBACK_REQUESTED",
      "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL", "OVERDUE", "PAST_DUE",
      "PAYMENT_FAILED", "CREDIT_CARD_CAPTURE_REFUSED"].includes(assinatura.status)) {
      status = tipoEvento === "SUBSCRIPTION_DELETED"
        ? "DELETED"
        : "INACTIVE";
    } else if (
      assinatura.ativo === true &&
      assinatura.renovacao_cancelada !== true &&
      !["CANCELED", "CANCELLED"].includes(
        String(assinatura.status || "").trim().toUpperCase()
      ) &&
      dadosAssinatura.status
    ) {
      status = String(dadosAssinatura.status)
        .trim()
        .toUpperCase();
    }

    const ativo = eventoEncerramento && !manterPeriodoPago
      ? false
      : assinatura.ativo;
    const assinaturaAtualizada = await assinaturaWebhookRepository
      .atualizarPorWebhook(
        client,
        {
          assinaturaId: assinatura.id,
          subscriptionId,
          customerId: dadosAssinatura.customer || null,
          status,
          formaPagamento: normalizarFormaPagamento(
            dadosAssinatura.billingType
          ),
          periodicidade: dadosAssinatura.cycle || null,
          valor: dadosAssinatura.value ?? null,
          proximaCobranca:
            dadosAssinatura.nextDueDate || null,
          ativo,
          renovacaoCancelada: eventoEncerramento,
          eventoCriadoEm:
            dadosAssinatura.webhookEventoCriadoEm || null,
          eventoId:
            dadosAssinatura.webhookEventoId || null,
        }
      );

    if (!assinaturaAtualizada) {
      return null;
    }

    if (
      tipoEvento === "SUBSCRIPTION_UPDATED" &&
      assinatura.ativo === true &&
      assinaturaAtualizada.ativo === true
    ) {
      await assinaturaLifecycleService
        .registrarAlteracaoValorRecorrente({
          client,
          assinaturaAnterior: assinatura,
          assinaturaAtualizada,
          origem: "webhook",
          referenciaIdempotencia:
            dadosAssinatura.webhookEventoId ||
            assinaturaAtualizada.asaas_ultimo_evento_id ||
            null,
          ocorridoEm: null,
        });
    }

    if (manterPeriodoPago) {
      await assinaturaLifecycleService
        .registrarCancelamentoRenovacao({
          client,
          assinatura: assinaturaAtualizada,
          acessoAte:
            assinaturaAtualizada.acesso_pago_ate ||
            assinatura.acesso_pago_ate ||
            assinaturaAtualizada.data_proxima_cobranca ||
            assinatura.data_proxima_cobranca ||
            null,
          origem: "webhook",
          motivo: "CANCELAMENTO_PROVEDOR",
        });
    }

    if (eventoEncerramento && !manterPeriodoPago) {
      const planoGratis = await assinaturaWebhookRepository
        .buscarPlanoGratis(client);

      if (!planoGratis?.id) {
        throw new Error(
          "Plano gratuito não encontrado para encerrar a assinatura."
        );
      }

      const negocioRetornouGratis =
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

      if (negocioRetornouGratis) {
        await reconciliarLimiteProfissionais(
          assinatura.negocio_id,
          client
        );

        await assinaturaLifecycleService
          .registrarEncerramentoAcesso({
            client,
            assinatura: assinaturaAtualizada,
            motivo: "ENCERRAMENTO_PROVEDOR",
            origem: "webhook",
            referenciaIdempotencia:
              dadosAssinatura.webhookEventoId ||
              assinaturaAtualizada.asaas_ultimo_evento_id ||
              tipoEvento,
          });
      }
    }

    return assinaturaAtualizada;
  });
}

module.exports = {
  sincronizarAssinaturaPorWebhook,
};
