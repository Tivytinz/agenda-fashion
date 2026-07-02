const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const authAdmin = require("../middlewares/authAdmin");
const adminController = require("../controllers/adminController");

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

module.exports = router;