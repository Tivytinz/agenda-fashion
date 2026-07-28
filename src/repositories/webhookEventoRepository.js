const db = require("../db/db");

async function registrarRecebimento({
  provedor,
  eventoId,
  tipoEvento,
  recursoId,
}) {
  const insercao = await db.query(
    `
    INSERT INTO webhook_eventos (
      provedor,
      evento_id,
      tipo_evento,
      recurso_id,
      status,
      tentativas,
      ultima_tentativa_em
    )
    VALUES (
      $1, $2, $3, $4,
      'PROCESSING', 1, NOW()
    )
    ON CONFLICT (
      provedor,
      evento_id
    )
    DO NOTHING
    RETURNING *
    `,
    [
      provedor,
      eventoId,
      tipoEvento,
      recursoId || null,
    ]
  );

  if (insercao.rows[0]) {
    return {
      processar: true,
      novo: true,
      evento:
        insercao.rows[0],
    };
  }

  /*
   * Eventos que falharam podem ser tentados novamente.
   * PROCESSING antigo também pode ser recuperado caso o
   * processo tenha sido interrompido antes da conclusão.
   */
  const retomada = await db.query(
    `
    UPDATE webhook_eventos
    SET
      status = 'PROCESSING',
      tentativas = tentativas + 1,
      erro = NULL,
      processado_em = NULL,
      ultima_tentativa_em = NOW()
    WHERE provedor = $1
      AND evento_id = $2
      AND (
        status = 'FAILED'
        OR (
          status = 'PROCESSING'
          AND ultima_tentativa_em
            < NOW() - INTERVAL '5 minutes'
        )
      )
    RETURNING *
    `,
    [
      provedor,
      eventoId,
    ]
  );

  if (retomada.rows[0]) {
    return {
      processar: true,
      novo: false,
      evento:
        retomada.rows[0],
    };
  }

  const duplicado = await db.query(
    `
    UPDATE webhook_eventos
    SET
      tentativas = tentativas + 1,
      ultima_tentativa_em = NOW()
    WHERE provedor = $1
      AND evento_id = $2
    RETURNING *
    `,
    [
      provedor,
      eventoId,
    ]
  );

  return {
    processar: false,
    novo: false,
    evento:
      duplicado.rows[0] || null,
  };
}

async function marcarConcluido(
  id,
  status
) {
  const resultado = await db.query(
    `
    UPDATE webhook_eventos
    SET
      status = $2,
      erro = NULL,
      processado_em = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      status,
    ]
  );

  return resultado.rows[0] || null;
}

async function marcarFalha(
  id,
  erro
) {
  const resultado = await db.query(
    `
    UPDATE webhook_eventos
    SET
      status = 'FAILED',
      erro = $2,
      processado_em = NULL
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      String(erro || "")
        .slice(0, 2000),
    ]
  );

  return resultado.rows[0] || null;
}

module.exports = {
  registrarRecebimento,
  marcarConcluido,
  marcarFalha,
};
