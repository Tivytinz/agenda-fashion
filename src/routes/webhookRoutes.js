const express = require("express");
const router = express.Router();

const webhookController = require("../controllers/webhookController");
const autenticarWebhookAsaas = require(
  "../middlewares/autenticarWebhookAsaas"
);
const autenticarWebhookWhatsapp = require(
  "../middlewares/autenticarWebhookWhatsapp"
);
const whatsappWebhookController = require(
  "../controllers/whatsappWebhookController"
);

router.post(
  "/webhook/asaas",
  autenticarWebhookAsaas,
  webhookController.receberWebhookAsaas
);

router.get(
  "/webhook/whatsapp",
  whatsappWebhookController
    .verificarWebhook
);

router.post(
  "/webhook/whatsapp",
  autenticarWebhookWhatsapp,
  whatsappWebhookController
    .receberStatus
);

module.exports = router;
