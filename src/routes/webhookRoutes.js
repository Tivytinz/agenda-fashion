const express = require("express");
const router = express.Router();

const webhookController = require("../controllers/webhookController");
const autenticarWebhookAsaas = require(
  "../middlewares/autenticarWebhookAsaas"
);

router.post(
  "/webhook/asaas",
  autenticarWebhookAsaas,
  webhookController.receberWebhookAsaas
);

module.exports = router;
