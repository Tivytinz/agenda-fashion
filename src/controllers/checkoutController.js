const checkoutService = require("../services/checkoutService");
const metaAdsService = require(
  "../services/metaAdsService"
);

async function criarCheckout(req, res, next) {
  try {
    const contextoMeta =
      metaAdsService
        .criarContextoRequisicao(
          req,
          req.body?.meta
        );

    await metaAdsService
      .salvarConsentimentoSeguro({
        usuarioId: req.user?.id,
        meta: req.body?.meta
      });

    const resultado =
      await checkoutService.criarCheckout({
        usuarioId: req.user?.id,
        planoId: req.body.plano_id,
        formaPagamento: req.body.forma_pagamento,
        cpfCnpj: req.body.cpf_cnpj,
        chaveIdempotencia:
          req.get("Idempotency-Key")
      });

    metaAdsService
      .enviarCheckoutSeguro({
        usuarioId: req.user?.id,
        contexto:
          contextoMeta,
        plano: {
          id: req.body.plano_id,
          valor:
            resultado?.assinatura
              ?.valor
        },
        resultado
      });

    return res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function consultarStatusCheckout(req, res, next) {
  try {
    const resultado =
      await checkoutService.consultarStatusCheckout({
        usuarioId: req.user?.id,
        pagamentoId: req.params.pagamento_id
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  criarCheckout,
  consultarStatusCheckout
};
