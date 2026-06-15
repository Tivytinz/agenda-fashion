const express = require("express");
const router = express.Router();

// =============================
// 🔐 MIDDLEWARES
// =============================
const auth = require("../middlewares/auth");
const authAdmin = require("../middlewares/authAdmin");

// =============================
// 🎮 CONTROLLERS
// =============================
const authController = require("../controllers/authController");
const negocioController = require("../controllers/negocioController");
const configuracoesController = require("../controllers/configuracoesController");
const servicosController = require("../controllers/servicosController");
const perfilNegocioController = require("../controllers/perfilNegocioController");
const agendaController = require("../controllers/agendaController");
const agendaPublicaController = require("../controllers/agendaPublicaController");
const dashboardController = require("../controllers/dashboardController");
const contaController = require("../controllers/contaController");
const favoritosController = require("../controllers/favoritosController");
const adminController = require("../controllers/adminController");

// =============================
// 🔐 AUTH
// =============================
router.post("/login", authController.login);
router.post("/cadastro", authController.cadastro);

// =============================
// 🏢 NEGÓCIO
// =============================
router.post("/criar-negocio", auth, negocioController.criarNegocio);
router.get("/meu-negocio", auth, negocioController.buscarMeuNegocio);

// =============================
// ⚙️ CONFIGURAÇÕES
// =============================
router.get("/configuracoes", auth, configuracoesController.buscarConfiguracoes);
router.put("/configuracoes", auth, configuracoesController.salvarConfiguracoes);

// =============================
// 🛠️ SERVIÇOS
// =============================
router.get("/servicos", auth, servicosController.listarServicos);
router.post("/servicos", auth, servicosController.criarServico);
router.put("/servicos/:id", auth, servicosController.editarServico);
router.delete("/servicos/:id", auth, servicosController.removerServico);

// =============================
// 🌍 PÚBLICO
// =============================
router.get("/negocios-publicos", perfilNegocioController.listarNegociosPublicos);
router.get("/perfil-negocio/:slug", perfilNegocioController.buscarPerfilPublico);

// =============================
// 📅 AGENDA PÚBLICA
// =============================
router.get("/agenda-publica", agendaPublicaController.buscarAgendaPublica);
router.post("/agendamentos", agendaPublicaController.criarAgendamentoPublico);
router.get("/meus-agendamentos", auth, agendaPublicaController.listarMeusAgendamentos);
router.patch("/agendamentos/:id/cancelar", auth, agendaPublicaController.cancelarMeuAgendamento);
router.patch("/agendamentos/:id/avaliar", auth, agendaPublicaController.avaliarAgendamento);

// =============================
// 📅 AGENDA GERAL (DONO)
// =============================

router.get(
  "/agenda-geral",
  auth,
  agendaController.buscarAgendaGeral
);

// =============================
// 👨‍🔧 AGENDA PROFISSIONAL
// =============================
// rota privada: usa o profissional logado
router.get(
  "/agenda-profissional",
  auth,
  agendaController.listarAgendamentosFuncionario
);

router.post(
  "/bloqueios-horario",
  auth,
  agendaController.alternarBloqueioHorario
);

router.get(
  "/agendamentos-profissional",
  auth,
  agendaController.listarAgendamentosFuncionario
);

// =============================
// 📊 DASHBOARD
// =============================
router.get(
  "/dashboard-profissional",
  auth,
  dashboardController.buscarDashboardProfissional
);

// =============================
// 📊 DASHBOARD DONO
// =============================
router.get(
  "/dashboard-dono",
  auth,
  dashboardController.buscarDashboardDono
);

// =============================
// ⚙️ CONTA
// =============================
router.get("/minha-conta", auth, contaController.buscarMinhaConta);
router.put("/minha-conta", auth, contaController.atualizarMinhaConta);
router.put("/minha-conta/senha", auth, contaController.alterarSenha);

// =============================
// ❤️ FAVORITOS
// =============================
router.get("/favoritos", auth, favoritosController.listarFavoritos);
router.post("/favoritos/:negocioId", auth, favoritosController.adicionarFavorito);
router.delete("/favoritos/:negocioId", auth, favoritosController.removerFavorito);
router.get("/favoritos/:negocioId/status", auth, favoritosController.verificarFavorito);

// =============================
// 🛡️ ADMIN
// =============================
router.get(
  "/admin/dashboard",
  auth,
  authAdmin,
  adminController.buscarDashboardAdmin
);

router.get(
  "/admin/negocios",
  auth,
  authAdmin,
  adminController.listarNegociosAdmin
);

router.get(
  "/admin/agendamentos",
  auth,
  authAdmin,
  adminController.listarAgendamentosAdmin
);

router.get(
  "/admin/marketing",
  auth,
  authAdmin,
  adminController.buscarMarketingAdmin
);

// =============================
module.exports = router;