const db = require("../db/db");

async function negocioTemAgendaConfigurada(
  negocioId
) {
  const id = Number(
    negocioId
  );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return false;
  }

  const result = await db.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM usuarios_negocios un
        INNER JOIN usuarios u
          ON u.id = un.usuario_id
        INNER JOIN agenda_configuracoes ac
          ON ac.profissional_id =
            un.usuario_id
        WHERE un.negocio_id = $1
          AND un.ativo = TRUE
          AND u.ativo = TRUE
          AND un.papel IN (
            'dono',
            'profissional'
          )
          AND ac.configurado_em
            IS NOT NULL
      ) AS configurada
    `,
    [id]
  );

  return Boolean(
    result.rows[0]?.configurada
  );
}

module.exports = {
  negocioTemAgendaConfigurada,
};
