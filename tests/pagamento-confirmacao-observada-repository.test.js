jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn()
  })
);

const repository = require(
  "../src/repositories/pagamentoRepository"
);

describe(
  "Pagamento: instante observado da confirmação",
  () => {
    test(
      "preserva a primeira observação precisa sem substituir a data financeira",
      async () => {
        const client = {
          query: jest.fn()
            .mockResolvedValue({
              rows: [
                {
                  id: 10,
                  status: "RECEIVED",
                  data_pagamento:
                    "2026-10-06",
                  confirmacao_observada_em:
                    "2026-10-06T22:15:04.000Z"
                }
              ]
            })
        };

        await repository
          .atualizarStatusPagamento(
            client,
            "pay_1",
            {
              status: "RECEIVED",
              data_pagamento:
                "2026-10-06",
              confirmacao_observada_em:
                "2026-10-06T22:15:04.000Z",
              invoice_url: null,
              evento_criado_em:
                "2026-10-06 19:15:00",
              evento_id: "evt_1"
            }
          );

        const [sql, parametros] =
          client.query.mock.calls[0];

        expect(sql).toContain(
          "data_pagamento = COALESCE($2, data_pagamento)"
        );
        expect(sql).toContain(
          "confirmacao_observada_em = COALESCE("
        );
        expect(sql).toContain(
          "confirmacao_observada_em,"
        );
        expect(sql).toContain(
          "$3::timestamptz"
        );
        expect(parametros).toEqual([
          "RECEIVED",
          "2026-10-06",
          "2026-10-06T22:15:04.000Z",
          null,
          "2026-10-06 19:15:00",
          "evt_1",
          "pay_1"
        ]);
      }
    );
  }
);
