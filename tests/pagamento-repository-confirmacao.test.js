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
  "Persistência temporal de pagamentos",
  () => {
    test(
      "salva instante preciso separado da data contábil no update ordenado",
      async () => {
        const client = {
          query: jest.fn().mockResolvedValue({
            rows: [
              {
                id: 31,
                confirmado_em:
                  "2026-10-06T20:15:30.000Z"
              }
            ]
          })
        };

        await repository
          .atualizarStatusPagamento(
            client,
            "pay_1",
            {
              status: "CONFIRMED",
              data_pagamento:
                "2026-10-06T20:15:30.000Z",
              confirmado_em:
                "2026-10-06T20:15:30.000Z",
              invoice_url:
                "https://example.com/fatura",
              evento_criado_em:
                "2026-10-06 20:15:31",
              evento_id: "evt_1"
            }
          );

        const [sql, parametros] =
          client.query.mock.calls[0];

        expect(sql).toContain(
          "confirmado_em = COALESCE"
        );
        expect(sql).toContain(
          "$3::timestamptz"
        );
        expect(sql).toContain(
          "WHERE asaas_payment_id = $7"
        );
        expect(
          String(sql).replace(/\s+/g, " ")
        ).toContain(
          "$5::timestamp >= asaas_ultimo_evento_em"
        );
        expect(parametros).toEqual([
          "CONFIRMED",
          "2026-10-06T20:15:30.000Z",
          "2026-10-06T20:15:30.000Z",
          "https://example.com/fatura",
          "2026-10-06 20:15:31",
          "evt_1",
          "pay_1"
        ]);
      }
    );

    test(
      "insert aceita confirmado_em sem reescrever o instante em conflito",
      async () => {
        const client = {
          query: jest.fn().mockResolvedValue({
            rows: [
              { id: 31 }
            ]
          })
        };

        await repository.criarPagamento(
          client,
          {
            assinatura_id: 11,
            asaas_payment_id: "pay_1",
            valor: 59.9,
            forma_pagamento: "pix",
            status: "CONFIRMED",
            data_vencimento: "2026-10-06",
            data_pagamento: "2026-10-06",
            confirmado_em:
              "2026-10-06T20:15:30.000Z"
          }
        );

        const [sql, parametros] =
          client.query.mock.calls[0];

        expect(sql).toContain(
          "confirmado_em"
        );
        expect(sql).not.toContain(
          "confirmado_em = COALESCE"
        );
        expect(parametros[7]).toBe(
          "2026-10-06T20:15:30.000Z"
        );
      }
    );
  }
);
