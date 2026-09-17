const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const {
  limitarConvitesProfissionais
} = require("../middlewares/rateLimits");

const {
  listarProfissionais,
  vincularProfissional,
  criarConviteProfissional,
  listarConvitesRecebidos,
  aceitarConviteProfissional,
  recusarConviteProfissional,
  editarProfissional,
  removerProfissional
} = require("../controllers/profissionaisController");

router.get("/profissionais", auth, listarProfissionais);
router.put("/profissionais/:id", auth, editarProfissional);
router.delete("/profissionais/:id", auth, removerProfissional);

router.get(
  "/profissionais/convites/recebidos",
  auth,
  listarConvitesRecebidos
);

router.post(
  "/profissionais/convites",
  auth,
  limitarConvitesProfissionais,
  criarConviteProfissional
);

router.post(
  "/profissionais/convites/:id/aceitar",
  auth,
  aceitarConviteProfissional
);

router.post(
  "/profissionais/convites/:id/recusar",
  auth,
  recusarConviteProfissional
);

/*
 * Compatibilidade temporária.
 * Não vincula mais diretamente: cria convite pendente.
 */
router.post(
  "/profissionais/vincular",
  auth,
  limitarConvitesProfissionais,
  vincularProfissional
);

module.exports = router;
