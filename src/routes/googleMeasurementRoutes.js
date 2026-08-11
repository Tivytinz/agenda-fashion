const express = require("express");

const auth = require(
  "../middlewares/auth"
);
const googleMeasurementController = require(
  "../controllers/googleMeasurementController"
);

const router = express.Router();

router.get(
  "/marketing/google/config",
  googleMeasurementController.configuracaoPublica
);

router.post(
  "/marketing/google/consentimento",
  auth,
  googleMeasurementController.atualizarConsentimento
);

module.exports = router;
