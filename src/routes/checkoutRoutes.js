const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const checkoutController = require("../controllers/checkoutController");

router.post("/checkout", auth, checkoutController.criarCheckout);

router.get(
  "/checkout/status/:pagamento_id",
  auth,
  checkoutController.consultarStatusCheckout
);

module.exports = router;