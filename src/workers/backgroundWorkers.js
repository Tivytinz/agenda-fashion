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

function iniciarWorkers() {
  iniciarWorkerWebhook();
  iniciarWorkerWhatsapp();
  iniciarWorkerCustosMarketing();
  iniciarWorkerMlNoShow();
  iniciarWorkerBillingReconciliation();
}

async function pararWorkers() {
  return Promise.allSettled([
    pararWorkerWebhook(),
    pararWorkerWhatsapp(),
    pararWorkerCustosMarketing(),
    pararWorkerMlNoShow(),
    pararWorkerBillingReconciliation(),
  ]);
}

module.exports = {
  iniciarWorkers,
  pararWorkers,
};
