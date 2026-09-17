const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const planoController = require("../controllers/planoController");

// =============================
// 📋 LISTAR PLANOS
// =============================
router.get("/planos", (req, res, next) => {
  const accept = String(
    req.headers.accept || ""
  ).toLowerCase();
  const solicitaJson =
    accept.includes("application/json") &&
    !accept.includes("text/html");

  res.vary("Accept");

  if (!solicitaJson) {
    return next();
  }

  return planoController.listarPlanos(
    req,
    res,
    next
  );
});

// =============================
// 💎 MEU PLANO
// =============================
router.get(
  "/meu-plano",
  auth,
  planoController.buscarMeuPlano
);

module.exports = router;
