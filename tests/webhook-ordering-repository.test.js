jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn()
  })
);

const db = require(
  "../src/db/db"
);
const webhookRepository = require(
  "../src/repositories/webhookEventoRepository"
);
const pagamentoRepository = require(
  "../src/repositories/pagamentoRepository"
);

describe(
  "Versionamento dos webhooks Asaas",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "persiste a data de criação informada pelo provedor",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              status: "PENDING"
            }
          ]
        });

        await webhookRepository
          .registrarRecebimento({
            provedor: "asaas",
            eventoId: "evt_1",
            tipoEvento: "PAYMENT_RECEIVED",
            recursoId: "pay_1",
            eventoCriadoEm:
              "2026-09-13 20:10:11",
            payload: {
              id: "evt_1"
            }
          });

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql)
          .toContain("evento_criado_em");
        expect(sql)
          .toContain("$5::timestamp");
        expect(parametros[4])
          .toBe("2026-09-13 20:10:11");
      }
    );

    test(
      "pagamento só aceita evento sem versão ou não anterior ao último aplicado",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 9,
              status: "RECEIVED"
            }
          ]
        });

        await pagamentoRepository
          .atualizarStatusPagamento(
            null,
            "pay_1",
            {
              status: "RECEIVED",
              data_pagamento:
                "2026-09-13",
              evento_criado_em:
                "2026-09-13 20:10:11",
              evento_id:
                "evt_received"
            }
          );

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql)
          .toContain(
            "asaas_ultimo_evento_em"
          );
        expect(sql)
          .toContain(
            "asaas_ultimo_evento_id"
          );
        expect(sql)
          .toContain(
            "$4::timestamp >="
          );
        expect(parametros)
          .toEqual([
            "RECEIVED",
            "2026-09-13",
            null,
            "2026-09-13 20:10:11",
            "evt_received",
            "pay_1"
          ]);
      }
    );
  }
);
