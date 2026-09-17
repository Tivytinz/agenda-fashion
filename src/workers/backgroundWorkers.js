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

function iniciarWorkers() {
  iniciarWorkerWebhook();
  iniciarWorkerWhatsapp();
  iniciarWorkerCustosMarketing();
}

async function pararWorkers() {
  return Promise.allSettled([
    pararWorkerWebhook(),
    pararWorkerWhatsapp(),
    pararWorkerCustosMarketing(),
  ]);
}

module.exports = {
  iniciarWorkers,
  pararWorkers,
};
