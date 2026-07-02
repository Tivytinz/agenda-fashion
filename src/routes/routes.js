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
const notificacoesController = require("../controllers/notificacoesController");

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
// 🛠️ SERVIÇOS
// =============================
router.get("/servicos", auth, servicosController.listarServicos);
router.post("/servicos", auth, servicosController.criarServico);
router.put("/servicos/:id", auth, servicosController.editarServico);
router.delete("/servicos/:id", auth, servicosController.removerServico);

// =============================
// ⚙️ CONTA
// =============================
router.get("/minha-conta", auth, contaController.buscarMinhaConta);
router.put("/minha-conta", auth, contaController.atualizarMinhaConta);
router.put("/minha-conta/senha", auth, contaController.alterarSenha);



// =============================
module.exports = router;