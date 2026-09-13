const {
  randomUUID
} = require("node:crypto");

const db = require(
  "../src/db/db"
);

describe(
  "Schema de ordenação dos webhooks",
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
      "persiste evento_criado_em sem depender do fuso do banco",
      async () => {
        eventoId =
          `test_order_${randomUUID()}`;

        const resultado =
          await db.query(
            `
            INSERT INTO webhook_eventos (
              provedor,
              evento_id,
              tipo_evento,
              recurso_id,
              evento_criado_em,
              status,
              tentativas,
              payload
            )
            VALUES (
              'asaas',
              $1,
              'PAYMENT_RECEIVED',
              'pay_ordering_schema',
              '2026-09-13 20:10:11'::timestamp,
              'PENDING',
              0,
              '{}'::jsonb
            )
            RETURNING
              TO_CHAR(
                evento_criado_em,
                'YYYY-MM-DD HH24:MI:SS'
              ) AS evento_criado_em
            `,
            [eventoId]
          );

        expect(resultado.rows[0])
          .toEqual({
            evento_criado_em:
              "2026-09-13 20:10:11"
          });
      }
    );
  }
);
