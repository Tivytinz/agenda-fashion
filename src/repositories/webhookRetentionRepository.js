const db = require(
  "../db/db"
);

async function redigirEventosFinalizadosAntigos(
  diasRetencao
) {
  const dias =
    Number(diasRetencao);

  if (
    !Number.isInteger(dias) ||
    dias <= 0
  ) {
    throw new TypeError(
      "Período de retenção de webhooks inválido."
    );
  }

  const resultado =
    await db.query(
      `
      UPDATE webhook_eventos
      SET
        payload = NULL,
        erro = NULL
      WHERE status IN (
        'PROCESSED',
        'IGNORED'
      )
        AND processado_em IS NOT NULL
        AND processado_em <
          NOW() - (
            $1::integer *
            INTERVAL '1 day'
          )
        AND (
          payload IS NOT NULL
          OR erro IS NOT NULL
        )
      `,
      [dias]
    );

  return Number(
    resultado.rowCount || 0
  );
}

module.exports = {
  redigirEventosFinalizadosAntigos,
};
