const express = require("express");
const router = express.Router();

const db = require("../db");
const auth = require("../middlewares/auth");

// =============================
// 📋 LISTAR PLANOS
// =============================
router.get("/planos", async (req, res) => {
  try {
    const resultado = await db.query(
      `
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
      `
    );

    return res.json({
      planos: resultado.rows
    });

  } catch (erro) {
    console.error("Erro ao listar planos:", erro);

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
            AND a.status != 'cancelado'
            AND a.data >= date_trunc('month', CURRENT_DATE)
            AND a.data < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
        ) AS utilizados

      FROM usuarios_negocios un
      INNER JOIN negocios n
        ON n.id = un.negocio_id
      INNER JOIN planos p
        ON p.id = n.plano_id
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
    const utilizados = Number(plano.utilizados || 0);
    const ilimitado = capacidade === null;

    const restantes = ilimitado
      ? null
      : Math.max(Number(capacidade || 0) - utilizados, 0);

    const percentual = ilimitado
      ? null
      : Math.min(
          Math.round((utilizados / Number(capacidade || 1)) * 100),
          100
        );

    let status = "normal";

    if (ilimitado) {
      status = "ilimitado";
    } else if (utilizados >= Number(capacidade || 0)) {
      status = "limite_atingido";
    } else if (percentual >= 80) {
      status = "quase_cheio";
    } else if (percentual >= 50) {
      status = "crescendo";
    }

    return res.json({
      negocio_id: plano.negocio_id,
      negocio_nome: plano.negocio_nome,

      plano_id: plano.plano_id,
      plano_nome: plano.plano_nome,
      plano_slug: plano.plano_slug,
      valor: plano.valor,
      capacidade_agendamentos: capacidade,
      destaque: plano.destaque,

      utilizados,
      restantes,
      percentual,
      ilimitado,
      status,

      mensagem:
        status === "limite_atingido"
          ? "🎉 Parabéns! Sua agenda atingiu a capacidade do plano. O limite significa sucesso."
          : status === "quase_cheio"
            ? `🚀 Sua agenda está quase cheia. Faltam apenas ${restantes} agendamento(s) para atingir a capacidade do plano.`
            : status === "crescendo"
              ? "Seu negócio está crescendo no Agenda Fashion."
              : status === "ilimitado"
                ? "Seu negócio possui capacidade ilimitada de agendamentos."
                : "Acompanhe aqui o crescimento da sua agenda este mês."
    });

  } catch (erro) {
    console.error("Erro ao buscar meu plano:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar plano atual."
    });
  }
});

module.exports = router;