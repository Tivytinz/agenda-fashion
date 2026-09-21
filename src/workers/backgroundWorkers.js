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

function iniciarWorkers() {
  iniciarWorkerWebhook();
  iniciarWorkerWhatsapp();
  iniciarWorkerCustosMarketing();
  iniciarWorkerMlNoShow();
}

async function pararWorkers() {
  return Promise.allSettled([
    pararWorkerWebhook(),
    pararWorkerWhatsapp(),
    pararWorkerCustosMarketing(),
    pararWorkerMlNoShow(),
  ]);
}

module.exports = {
  iniciarWorkers,
  pararWorkers,
};
