const db = require("../db/db");
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
    const assinatura = await localizarAssinaturaPorWebhook(
      client,
      subscriptionId,
      dadosAssinatura.externalReference
    );

    if (!assinatura) {
      return null;
    }

    const eventoEncerramento = [
      "SUBSCRIPTION_INACTIVATED",
      "SUBSCRIPTION_DELETED",
    ].includes(tipoEvento);
    const manterPeriodoPago =
      tipoEvento === "SUBSCRIPTION_DELETED" &&
      acessoPagoAindaValido(assinatura);

    let status = assinatura.status;

    if (manterPeriodoPago) {
      status = "CANCELED";
    } else if (eventoEncerramento) {
      status = tipoEvento === "SUBSCRIPTION_DELETED"
        ? "DELETED"
        : "INACTIVE";
    } else if (
      assinatura.ativo === true &&
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
          eventoCriadoEm:
            dadosAssinatura.webhookEventoCriadoEm || null,
          eventoId:
            dadosAssinatura.webhookEventoId || null,
        }
      );

    if (!assinaturaAtualizada) {
      return null;
    }

    if (manterPeriodoPago) {
      await assinaturaLifecycleService
        .registrarCancelamentoRenovacao({
          client,
          assinatura: assinaturaAtualizada,
          acessoAte:
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

      await assinaturaLifecycleService
        .registrarEncerramentoAcesso({
          client,
          assinatura: assinaturaAtualizada,
          motivo: "ENCERRAMENTO_PROVEDOR",
          origem: "webhook",
        });
    }

    return assinaturaAtualizada;
  });
}

module.exports = {
  sincronizarAssinaturaPorWebhook,
};
