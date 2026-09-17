/*
 * Fachada interna do domínio de assinaturas.
 *
 * Os casos de uso ficam separados por responsabilidade para que mudanças em
 * conta, webhooks ou pagamentos não ampliem o risco do domínio financeiro.
 */
const registroService = require(
  "./assinaturaRegistroService"
);
const webhookService = require(
  "./assinaturaWebhookService"
);
const pagamentoService = require(
  "./assinaturaPagamentoService"
);
const contaService = require(
  "./assinaturaContaService"
);

module.exports = {
  ...registroService,
  ...webhookService,
  ...pagamentoService,
  ...contaService,
};
