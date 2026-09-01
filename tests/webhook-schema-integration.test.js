const {
  randomUUID
} = require("node:crypto");

const db = require(
  "../src/db/db"
);

describe(
  "Schema da fila de webhooks",
  () => {
    let eventoId;

    afterEach(async () => {
      if (!eventoId) {
        return;
      }

      await db.query(
        `
        DELETE FROM webhook_eventos
        WHERE provedor = 'asaas'
          AND evento_id = $1
        `,
        [eventoId]
      );

      eventoId = null;
    });

    test(
      "aceita o estado inicial PENDING com zero tentativas",
      async () => {
        eventoId =
          `test_${randomUUID()}`;

        const resultado =
          await db.query(
            `
            INSERT INTO webhook_eventos (
              provedor,
              evento_id,
              tipo_evento,
              recurso_id,
              status,
              tentativas,
              payload
            )
            VALUES (
              'asaas',
              $1,
              'PAYMENT_CONFIRMED',
              'pay_schema_test',
              'PENDING',
              0,
              '{}'::jsonb
            )
            RETURNING status, tentativas
            `,
            [eventoId]
          );

        expect(resultado.rows[0])
          .toEqual({
            status: "PENDING",
            tentativas: 0
          });
      }
    );
  }
);
