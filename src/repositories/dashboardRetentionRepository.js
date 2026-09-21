const db = require("../db/db");

async function buscarResumoRetencao(
  negocioId
) {
  const result = await db.query(
    `
      WITH clientes AS (
        SELECT
          client_id AS cliente_chave,

          COUNT(*)::int
            AS total_agendamentos

        FROM agendamentos

        WHERE negocio_id = $1
          AND status != 'cancelado'

        GROUP BY
          cliente_chave
      )

      SELECT
        COUNT(*) FILTER (
          WHERE cliente_chave IS NOT NULL
        )::int AS clientes_unicos,

        COUNT(*) FILTER (
          WHERE cliente_chave IS NOT NULL
            AND total_agendamentos > 1
        )::int AS clientes_recorrentes

      FROM clientes
    `,
    [negocioId]
  );

  return (
    result.rows[0] || {
      clientes_unicos: 0,
      clientes_recorrentes: 0,
    }
  );
}

module.exports = {
  buscarResumoRetencao,
};
