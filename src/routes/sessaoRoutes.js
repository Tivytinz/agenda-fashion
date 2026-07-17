const express = require(
  "express"
);

const sessaoController = require(
  "../controllers/sessaoController"
);

const auth = require(
  "../middlewares/auth"
);

const router =
  express.Router();

/*
 * GET /minha-sessao
 *
 * Exige JWT válido.
 * O middleware auth adiciona:
 *
 * req.user = {
 *   id: usuarioId
 * }
 */
router.get(
  "/minha-sessao",
  auth,
  sessaoController.obterMinhaSessao
);

module.exports = router;