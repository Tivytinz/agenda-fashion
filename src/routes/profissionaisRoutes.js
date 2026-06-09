const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");

const {
  vincularProfissional,
  editarProfissional,
  removerProfissional
} = require("../controllers/profissionaisController");

router.put("/:id", auth, editarProfissional);
router.delete("/:id", auth, removerProfissional);
router.post("/vincular", auth, vincularProfissional);

module.exports = router;