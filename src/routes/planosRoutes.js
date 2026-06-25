const express = require("express");
const router = express.Router();
const pool = require("../db");
// const autenticarToken = require("../middlewares/autenticarToken");

// Listar todos os planos
router.get("/meu-plano/:negocioId", async (req, res) => {
  try {
    const resultado = await pool.query(`
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

    res.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao listar planos:", erro);
    res.status(500).json({ erro: "Erro ao listar planos." });
  }
});

// Buscar plano atual de um negócio
router.get("/meu-plano/:negocioId", autenticarToken, async (req, res) => {
  try {
    const { negocioId } = req.params;

    const planoResult = await pool.query(
      `
      SELECT 
        n.id AS negocio_id,
        n.nome AS negocio_nome,
        p.id AS plano_id,
        p.nome AS plano_nome,
        p.slug AS plano_slug,
        p.valor,
        p.capacidade_agendamentos,
        p.destaque
      FROM negocios n
      JOIN planos p ON p.id = n.plano_id
      WHERE n.id = $1
      LIMIT 1
      `,
      [negocioId]
    );

    if (planoResult.rows.length === 0) {
      return res.status(404).json({ erro: "Negócio não encontrado." });
    }

    const plano = planoResult.rows[0];

    const usoResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM agendamentos
      WHERE negocio_id = $1
      AND data >= date_trunc('month', CURRENT_DATE)
      AND data < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
      `,
      [negocioId]
    );

    const utilizados = usoResult.rows[0].total;
    const capacidade = plano.capacidade_agendamentos;

    res.json({
      ...plano,
      utilizados,
      ilimitado: capacidade === null,
      restantes: capacidade === null ? null : Math.max(capacidade - utilizados, 0),
      percentual:
        capacidade === null
          ? null
          : Math.min(Math.round((utilizados / capacidade) * 100), 100)
    });
  } catch (erro) {
    console.error("Erro ao buscar meu plano:", erro);
    res.status(500).json({ erro: "Erro ao buscar plano atual." });
  }
});

module.exports = router;