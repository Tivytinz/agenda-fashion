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
  ativarProfissional,
  recusarConviteProfissional,
  editarProfissional,
  removerProfissional
} = require("../controllers/profissionaisController");

const {
  listarServicosProfissional,
  atualizarServicosProfissional,
} = require(
  "../controllers/profissionalServicosController"
);

router.get("/profissionais", auth, listarProfissionais);
router.put("/profissionais/:id", auth, editarProfissional);
router.delete("/profissionais/:id", auth, removerProfissional);
router.post("/profissionais/:id/ativar", auth, ativarProfissional);

router.get(
  "/profissionais/:id/servicos",
  auth,
  listarServicosProfissional
);

router.put(
  "/profissionais/:id/servicos",
  auth,
  atualizarServicosProfissional
);

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
