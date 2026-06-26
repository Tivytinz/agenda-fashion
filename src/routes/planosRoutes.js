const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middlewares/auth");

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

// =============================
// 💎 MEU PLANO
// =============================
router.get("/meu-plano", auth, async (req, res) => {
  try {
    const usuarioId = req.user.id;

    const result = await db.query(
      `
      SELECT
        n.id AS negocio_id,
        n.nome AS negocio_nome,
        p.id AS plano_id,
        p.nome AS plano_nome,
        p.slug AS plano_slug,
        p.valor,
        p.capacidade_agendamentos,
        p.destaque,

        (
          SELECT COUNT(*)::int
          FROM agendamentos a
          WHERE a.negocio_id = n.id
          AND a.data >= date_trunc('month', CURRENT_DATE)
          AND a.data < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
        ) AS utilizados

      FROM usuarios_negocios un
      INNER JOIN negocios n ON n.id = un.negocio_id
      INNER JOIN planos p ON p.id = n.plano_id
      WHERE un.usuario_id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: "Negócio não encontrado."
      });
    }

    const plano = result.rows[0];
    const capacidade = plano.capacidade_agendamentos;
    const utilizados = plano.utilizados;

    return res.json({
      ...plano,
      ilimitado: capacidade === null,
      restantes: capacidade === null ? null : Math.max(capacidade - utilizados, 0),
      percentual:
        capacidade === null
          ? null
          : Math.min(Math.round((utilizados / capacidade) * 100), 100)
    });

  } catch (erro) {
    console.error("Erro ao buscar meu plano:", erro);
    return res.status(500).json({
      erro: "Erro ao buscar plano atual."
    });
  }
});

module.exports = router;