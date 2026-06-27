const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const checkoutController = require("../controllers/checkoutController");

router.post("/checkout", auth, checkoutController.criarCheckout);

module.exports = router;