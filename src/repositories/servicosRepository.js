const db = require("../db/db");

async function buscarNegocioDono(usuarioId) {
  const result = await db.query(
    `
    SELECT negocio_id
    FROM usuarios_negocios
    WHERE usuario_id = $1
      AND papel = 'dono'
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function listarServicos(negocioId) {
  const result = await db.query(
    `
    SELECT *
    FROM servicos_negocio
    WHERE negocio_id = $1
    ORDER BY nome
    `,
    [negocioId]
  );

  return result.rows;
}

async function criarServico({
  negocioId,
  nome,
  valor,
  duracaoMinutos,
}) {
  const result = await db.query(
    `
    INSERT INTO servicos_negocio (
      negocio_id,
      nome,
      valor,
      duracao_minutos,
      ativo,
      created_at
    )
    VALUES ($1, $2, $3, $4, true, NOW())
    RETURNING *
    `,
    [negocioId, nome, valor, duracaoMinutos]
  );

  return result.rows[0];
}

module.exports = {
  buscarNegocioDono,
  listarServicos,
  criarServico,
};