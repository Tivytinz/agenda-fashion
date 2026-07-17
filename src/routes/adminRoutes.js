const express = require("express");

const router = express.Router();

const auth = require("../middlewares/auth");
const authAdmin = require("../middlewares/authAdmin");

const adminController = require(
  "../controllers/adminController"
);

/*
 * Todas as rotas administrativas exigem:
 *
 * 1. Token JWT válido;
 * 2. usuário autenticado e ativo;
 * 3. registro ativo na tabela
 *    usuarios_administradores.
 *
 * A ordem é obrigatória:
 *
 * auth
 * → preenche req.user
 *
 * authAdmin
 * → consulta a permissão administrativa
 *   usando req.user.id
 */
router.use(auth);
router.use(authAdmin);

/*
 * Resumo geral da plataforma.
 *
 * Exemplos de período:
 *
 * /admin/dashboard?periodo=all
 * /admin/dashboard?periodo=today
 * /admin/dashboard?periodo=7
 * /admin/dashboard?periodo=30
 * /admin/dashboard?periodo=month
 */
router.get(
  "/admin/dashboard",
  adminController.buscarDashboardAdmin
);

/*
 * Lista os negócios cadastrados
 * na plataforma.
 */
router.get(
  "/admin/negocios",
  adminController.listarNegociosAdmin
);

/*
 * Lista os agendamentos recentes
 * de toda a plataforma.
 */
router.get(
  "/admin/agendamentos",
  adminController.listarAgendamentosAdmin
);

/*
 * Retorna informações administrativas
 * relacionadas a crescimento, cidades,
 * acessos e desempenho dos negócios.
 */
router.get(
  "/admin/marketing",
  adminController.buscarMarketingAdmin
);

module.exports = router;