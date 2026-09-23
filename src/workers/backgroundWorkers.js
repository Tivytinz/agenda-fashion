const {
  iniciarWorkerWebhook,
  pararWorkerWebhook,
} = require("../services/webhookService");
const {
  iniciarWorkerWhatsapp,
  pararWorkerWhatsapp,
} = require("../services/whatsappMensagemService");
const {
  iniciarWorkerCustosMarketing,
  pararWorkerCustosMarketing,
} = require("../services/marketingCostSyncWorker");
const {
  iniciarWorkerMlNoShow,
  pararWorkerMlNoShow,
} = require("../services/mlNoShowDataWorker");
const {
  iniciarWorkerBillingReconciliation,
  pararWorkerBillingReconciliation,
} = require("../services/billingReconciliationWorker");
const {
  iniciarWorkerAquisicaoFinanceira,
  pararWorkerAquisicaoFinanceira,
} = require(
  "../services/aquisicaoFinanceiraReconciliationWorker"
);

function iniciarWorkers() {
  iniciarWorkerWebhook();
  iniciarWorkerWhatsapp();
  iniciarWorkerCustosMarketing();
  iniciarWorkerMlNoShow();
  iniciarWorkerBillingReconciliation();
  iniciarWorkerAquisicaoFinanceira();
}

async function pararWorkers() {
  return Promise.allSettled([
    pararWorkerWebhook(),
    pararWorkerWhatsapp(),
    pararWorkerCustosMarketing(),
    pararWorkerMlNoShow(),
    pararWorkerBillingReconciliation(),
    pararWorkerAquisicaoFinanceira(),
  ]);
}

module.exports = {
  iniciarWorkers,
  pararWorkers,
};
