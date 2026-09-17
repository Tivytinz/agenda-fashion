const db = require("../db/db");

async function listarPlanosAtivos(executor = db) {
  const resultado = await executor.query(
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

  return resultado.rows;
}

async function buscarNegocioAtivoDoDono(
  usuarioId,
  executor = db
) {
  const resultado = await executor.query(
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

  return resultado.rows[0] || null;
}

module.exports = {
  listarPlanosAtivos,
  buscarNegocioAtivoDoDono,
};
