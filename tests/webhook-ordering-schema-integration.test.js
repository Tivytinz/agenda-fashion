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
  "Schema de ordenação dos webhooks",
  () => {
    const eventosCriados =
      new Set();

    afterEach(async () => {
      const ids =
        Array.from(eventosCriados);

      if (ids.length === 0) {
        return;
      }

      await db.query(
        `
        DELETE FROM webhook_eventos
        WHERE provedor = 'asaas'
          AND evento_id = ANY($1::varchar[])
        `,
        [ids]
      );

      eventosCriados.clear();
    });

    test(
      "persiste evento_criado_em sem depender do fuso do banco",
      async () => {
        const eventoId =
          `test_order_${randomUUID()}`;
        eventosCriados.add(eventoId);

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

    test(
      "evento antigo só é descartado depois que o mais novo foi aplicado",
      async () => {
        const sufixo =
          randomUUID();
        const eventoAntigo =
          `test_old_${sufixo}`;
        const eventoNovo =
          `test_new_${sufixo}`;
        const recursoId =
          `pay_order_${sufixo}`;

        eventosCriados.add(eventoAntigo);
        eventosCriados.add(eventoNovo);

        const insercao =
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
            VALUES
              (
                'asaas',
                $1,
                'PAYMENT_OVERDUE',
                $3,
                '2026-09-13 20:00:00'::timestamp,
                'PENDING',
                0,
                '{}'::jsonb
              ),
              (
                'asaas',
                $2,
                'PAYMENT_RECEIVED',
                $3,
                '2026-09-13 20:05:00'::timestamp,
                'IGNORED',
                0,
                '{}'::jsonb
              )
            RETURNING id, evento_id
            `,
            [
              eventoAntigo,
              eventoNovo,
              recursoId
            ]
          );

        const antigoId = Number(
          insercao.rows.find(
            (linha) =>
              linha.evento_id ===
                eventoAntigo
          ).id
        );

        const antesDoSucesso =
          await webhookEventoRepository
            .marcarObsoletoSeNecessario(
              antigoId
            );

        expect(antesDoSucesso)
          .toBeNull();

        const antigoPendente =
          await db.query(
            `
            SELECT status
            FROM webhook_eventos
            WHERE id = $1
            `,
            [antigoId]
          );

        expect(
          antigoPendente.rows[0]
            .status
        ).toBe("PENDING");

        await db.query(
          `
          UPDATE webhook_eventos
          SET status = 'PROCESSED',
              processado_em = NOW()
          WHERE provedor = 'asaas'
            AND evento_id = $1
          `,
          [eventoNovo]
        );

        const depoisDoSucesso =
          await webhookEventoRepository
            .marcarObsoletoSeNecessario(
              antigoId
            );

        expect(depoisDoSucesso)
          .toMatchObject({
            id: antigoId,
            status: "IGNORED"
          });
      }
    );
  }
);
