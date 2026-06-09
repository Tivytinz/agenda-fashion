const db = require("../db");

async function buscarPlano(req, res) {
  try {
    const negocio = req.negocio;

    return res.json({
      plano: negocio.plano,
      ativo: negocio.ativo,
      data_expiracao: negocio.data_expiracao
    });

  } catch (err) {
    console.error("Erro ao buscar plano:", err);
    return res.status(500).json({ erro: "Erro ao buscar plano." });
  }
}

async function ativarPlano(req, res) {
  try {
    const usuarioId = req.user.id;
    const { plano } = req.body;

    if (!["pro", "business"].includes(plano)) {
      return res.status(400).json({ erro: "Plano inválido." });
    }

    const result = await db.query(
      `
      SELECT negocio_id
      FROM usuarios_negocios
      WHERE usuario_id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: "Negócio não encontrado." });
    }

    const negocioId = result.rows[0].negocio_id;

    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 30);

    await db.query(
      `
      UPDATE negocios
      SET
        plano = $1,
        ativo = true,
        data_expiracao = $2
      WHERE id = $3
      `,
      [plano, dataExpiracao, negocioId]
    );

    return res.json({
      mensagem: "Plano ativado com sucesso."
    });

  } catch (err) {
    console.error("Erro ao ativar plano:", err);
    return res.status(500).json({ erro: "Erro ao ativar plano." });
  }
}

module.exports = {
  buscarPlano,
  ativarPlano
};