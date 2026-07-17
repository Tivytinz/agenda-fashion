const express = require(
  "express"
);

const negocioController = require(
  "../controllers/negocioController"
);

const auth = require(
  "../middlewares/auth"
);

const router =
  express.Router();

/*
 * POST /criar-negocio
 *
 * Cria um negócio e vincula a conta
 * autenticada como dona.
 */
router.post(
  "/criar-negocio",
  auth,
  negocioController.criarNegocio
);

/*
 * GET /meu-negocio
 *
 * Mantido para compatibilidade
 * com páginas antigas.
 *
 * O contexto completo da conta é
 * obtido por GET /minha-sessao.
 */
router.get(
  "/meu-negocio",
  auth,
  negocioController.buscarMeuNegocio
);

/*
 * Fluxo antigo temporariamente
 * indisponível.
 */
router.get(
  "/buscar-negocios",
  auth,
  negocioController.buscarNegocios
);

/*
 * A entrada direta em um negócio
 * foi bloqueada.
 *
 * Futuramente será substituída por
 * um fluxo de convite.
 */
router.post(
  "/entrar-negocio",
  auth,
  negocioController.entrarNoNegocio
);

module.exports = router;