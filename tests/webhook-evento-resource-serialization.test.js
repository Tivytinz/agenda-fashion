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
  "Serialização da fila por recurso financeiro",
  () => {
    let recursoId = null;

    afterEach(async () => {
      if (!recursoId) {
        return;
      }

      await db.query(
        `
        DELETE FROM webhook_eventos
        WHERE provedor = 'asaas'
          AND recurso_id = $1
        `,
        [recursoId]
      );

      recursoId = null;
    });

    test(
      "mantém apenas um evento PROCESSING por provedor e recurso",
      async () => {
        const sufixo = randomUUID();
        recursoId =
          `pay_serializacao_${sufixo}`;

        const primeiro =
          await webhookEventoRepository
            .registrarRecebimento({
              provedor: "asaas",
              eventoId:
                `evt_confirmed_${sufixo}`,
              tipoEvento:
                "PAYMENT_CONFIRMED",
              recursoId,
              payload: {}
            });

        const segundo =
          await webhookEventoRepository
            .registrarRecebimento({
              provedor: "asaas",
              eventoId:
                `evt_received_${sufixo}`,
              tipoEvento:
                "PAYMENT_RECEIVED",
              recursoId,
              payload: {}
            });

        const reservas =
          await Promise.all([
            webhookEventoRepository
              .reservarPorId(
                primeiro.evento.id
              ),
            webhookEventoRepository
              .reservarPorId(
                segundo.evento.id
              )
          ]);

        const processando =
          reservas.filter(Boolean);

        expect(processando)
          .toHaveLength(1);
        expect(processando[0].status)
          .toBe("PROCESSING");

        const estados = await db.query(
          `
          SELECT id, status
          FROM webhook_eventos
          WHERE provedor = 'asaas'
            AND recurso_id = $1
          ORDER BY id ASC
          `,
          [recursoId]
        );

        expect(
          estados.rows
            .map((item) => item.status)
            .sort()
        ).toEqual([
          "PENDING",
          "PROCESSING"
        ]);

        const reservado = processando[0];
        const pendente =
          estados.rows.find(
            (item) =>
              item.id !== reservado.id
          );

        await webhookEventoRepository
          .marcarConcluido(
            reservado.id,
            "PROCESSED",
            reservado.lease_tentativa
          );

        const reservaSeguinte =
          await webhookEventoRepository
            .reservarPorId(
              pendente.id
            );

        expect(reservaSeguinte)
          .toEqual(
            expect.objectContaining({
              id: pendente.id,
              status: "PROCESSING",
              lease_tentativa: 1
            })
          );
      }
    );
  }
);
