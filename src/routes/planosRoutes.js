const express = require("express");
const router = express.Router();

const db = require("../db/db");
const auth = require("../middlewares/auth");
const planoService = require("../services/planoService");
const registrador = require("../utils/registrador");

// =============================
// 📋 LISTAR PLANOS
// =============================
router.get("/planos", async (req, res, next) => {
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

  try {
    const resultado = await db.query(
      `
      SELECT
        id,
        nome,
        slug,
        valor,
        capacidade_agendamentos,
        limite_profissionais,
        limite_servicos,
        destaque,
        ativo
      FROM planos
      WHERE ativo = true
      ORDER BY valor ASC
      `
    );

    return res.json({
      planos: resultado.rows
    });

  } catch (erro) {
    registrador.erro("Não foi possível listar os planos.", erro);

    return res.status(500).json({
      erro: "Erro ao listar planos."
    });
  }
});

// =============================
// 💎 MEU PLANO
// =============================
router.get("/meu-plano", auth, async (req, res) => {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({
        erro: "Usuário não autenticado."
      });
    }

    const result = await db.query(
      `
      SELECT
        n.id AS negocio_id
      FROM usuarios_negocios un
      INNER JOIN negocios n
        ON n.id = un.negocio_id
      INNER JOIN usuarios u
        ON u.id = un.usuario_id
      WHERE un.usuario_id = $1
        AND un.ativo = TRUE
        AND un.papel = 'dono'
        AND n.ativo = TRUE
        AND u.ativo = TRUE
      LIMIT 1
      `,
      [usuarioId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: "Negócio não encontrado."
      });
    }

    const plano = await planoService.buscarUsoPlano(
      result.rows[0].negocio_id
    );

    return res.json(plano);

  } catch (erro) {
    registrador.erro("Não foi possível buscar o plano atual.", erro);

    return res.status(500).json({
      erro: "Erro ao buscar plano atual."
    });
  }
});

module.exports = router;
