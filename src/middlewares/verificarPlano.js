const db = require("../db");
const registrador = require("../utils/registrador");

async function buscarNegocioDoUsuario(usuarioId) {
  const result = await db.query(
    `
    SELECT n.*
    FROM usuarios_negocios un
    JOIN negocios n ON n.id = un.negocio_id
    WHERE un.usuario_id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function verificarPlano(req, res, next) {
  try {
    const usuarioId = req.user?.id;

    const negocio = await buscarNegocioDoUsuario(usuarioId);

    if (!negocio) {
      return res.status(404).json({
        erro: "Negócio não encontrado."
      });
    }

    // verifica se está ativo
    //if (!negocio.ativo) {
    //return res.status(403).json({
    //    erro: "Plano inativo. Faça o pagamento para continuar."
    //});
    //}

    // verifica expiração
    if (negocio.data_expiracao && new Date(negocio.data_expiracao) < new Date()) {
      return res.status(403).json({
        erro: "Seu plano expirou."
      });
    }

    req.negocio = negocio;
    next();

  } catch (err) {
    registrador.erro("Não foi possível validar o plano.", err);
    return res.status(500).json({ erro: "Erro ao validar plano." });
  }
}

module.exports = verificarPlano;
