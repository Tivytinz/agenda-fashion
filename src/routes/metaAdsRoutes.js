const express = require("express");

const auth = require(
  "../middlewares/auth"
);
const metaAdsController = require(
  "../controllers/metaAdsController"
);

const router = express.Router();

router.get(
  "/marketing/meta/config",
  metaAdsController.configuracaoPublica
);

router.post(
  "/marketing/meta/consentimento",
  auth,
  metaAdsController.atualizarConsentimento
);

module.exports = router;
