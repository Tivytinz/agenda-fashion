const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");

const {
  vincularProfissional,
  editarProfissional,
  removerProfissional
} = require("../controllers/profissionaisController");

router.put("/profissionais/:id", auth, editarProfissional);
router.delete("/profissionais/:id", auth, removerProfissional);
router.post("/profissionais/vincular", auth, vincularProfissional);

module.exports = router;