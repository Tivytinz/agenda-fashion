const {
  randomUUID
} = require("node:crypto");

const db = require(
  "../src/db/db"
);
const webhookEventoRepository = require(
  "../src/repositories/webhookEventoRepository"
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
      "CA-NFR-02: retry do mesmo webhook não duplica a operação enfileirada",
      async () => {
        eventoId =
          `test_${randomUUID()}`;

        const entrada = {
          provedor:
            "asaas",
          eventoId,
          tipoEvento:
            "PAYMENT_CONFIRMED",
          recursoId:
            "pay_retry_nfr",
          eventoCriadoEm:
            "2026-09-22 16:00:00",
          payload: {
            id: eventoId,
            payment: {
              id:
                "pay_retry_nfr",
            },
          },
        };

        const primeiro =
          await webhookEventoRepository
            .registrarRecebimento(
              entrada
            );

        const retry =
          await webhookEventoRepository
            .registrarRecebimento(
              entrada
            );

        expect(
          primeiro.novo
        ).toBe(true);
        expect(
          retry.novo
        ).toBe(false);
        expect(
          Number(
            retry.evento?.id
          )
        ).toBe(
          Number(
            primeiro.evento?.id
          )
        );

        const quantidade =
          await db.query(
            `
              SELECT COUNT(*)::INT
                AS total
              FROM webhook_eventos
              WHERE provedor = 'asaas'
                AND evento_id = $1
            `,
            [eventoId]
          );

        expect(
          quantidade.rows[0]
            .total
        ).toBe(1);
      }
    );

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
