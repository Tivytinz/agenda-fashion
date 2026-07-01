const db = require("../db/db");
const { buscarUsoPlano } = require("../services/planoService");

async function buscarMinhaAssinatura(req, res) {
    try {
        const usuarioId = req.user?.id;

        if (!usuarioId) {
            return res.status(401).json({ erro: "Usuário não autenticado." });
        }

        const negocioResult = await db.query(
            `
      SELECT n.id, n.plano_id
      FROM usuarios_negocios un
      INNER JOIN negocios n ON n.id = un.negocio_id
      WHERE un.usuario_id = $1
        AND un.papel = 'dono'
      LIMIT 1
      `,
            [usuarioId]
        );

        if (negocioResult.rows.length === 0) {
            return res.status(404).json({ erro: "Negócio não encontrado." });
        }

        const negocio = negocioResult.rows[0];

        const assinaturaResult = await db.query(
            `
      SELECT *
      FROM assinaturas
      WHERE negocio_id = $1
      ORDER BY id DESC
      LIMIT 1
      `,
            [negocio.id]
        );

        const planoResult = await db.query(
            `
      SELECT id, nome, slug, valor, capacidade_agendamentos
      FROM planos
      WHERE id = $1
      LIMIT 1
      `,
            [negocio.plano_id]
        );

        const pagamentosResult = await db.query(
            `
      SELECT
        id,
        asaas_payment_id,
        valor,
        forma_pagamento,
        status,
        data_vencimento,
        data_pagamento,
        created_at
      FROM pagamentos
      WHERE assinatura_id = $1
      ORDER BY id DESC
      LIMIT 12
      `,
            [assinaturaResult.rows[0]?.id || 0]
        );

        const uso = await buscarUsoPlano(negocio.id);

        return res.json({
            plano: planoResult.rows[0] || null,
            assinatura: assinaturaResult.rows[0] || null,
            uso: {
                utilizados: uso?.utilizados || 0,
                limite: uso?.capacidade_agendamentos ?? null,
                restantes: uso?.restantes ?? null,
                percentual: uso?.percentual ?? null
            },
            pagamentos: pagamentosResult.rows
        });

    } catch (err) {
        console.error("Erro ao buscar minha assinatura:", err);
        return res.status(500).json({ erro: "Erro ao carregar assinatura." });
    }
}

module.exports = {
    buscarMinhaAssinatura
};