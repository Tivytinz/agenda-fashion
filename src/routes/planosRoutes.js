const express = require("express");
const router = express.Router();
const db = require("../db");

// =============================
// 📋 LISTAR PLANOS
// =============================
router.get("/planos", async (req, res) => {
  try {
    const resultado = await db.query(`
      SELECT 
        id,
        nome,
        slug,
        valor,
        capacidade_agendamentos,
        destaque,
        ativo
      FROM planos
      WHERE ativo = true
      ORDER BY valor ASC
    `);

    return res.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao listar planos:", erro);
    return res.status(500).json({ erro: "Erro ao listar planos." });
  }
});

module.exports = router;