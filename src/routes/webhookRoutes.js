const express = require("express");
const router = express.Router();

const webhookController = require("../controllers/webhookController");

router.post("/webhook/asaas", webhookController.receberWebhookAsaas);

module.exports = router;