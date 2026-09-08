jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn()
  })
);

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/marketingConversaoRepository"
);

describe(
  "Conversão histórica de assinatura",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "primeiro pagamento independe do estado atual da assinatura",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              primeiro_pagamento: true
            }
          ]
        });

        const primeiro =
          await repository
            .ehPrimeiroPagamentoAssinatura({
              assinaturaId: 11,
              pagamentoId: "pay_1"
            });

        expect(primeiro).toBe(true);

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "NOT EXISTS"
        );
        expect(sql).toContain(
          "anterior.data_pagamento <"
        );
        expect(sql).toContain(
          "anterior.id < atual.id"
        );
        expect(sql).not.toContain(
          "a.ativo"
        );
        expect(sql).not.toContain(
          "a.status"
        );
        expect(parametros).toEqual([
          11,
          "pay_1"
        ]);
      }
    );

    test(
      "carrega valor e data do pagamento confirmado que originou a conversão",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 30,
              assinatura_id: 11,
              asaas_payment_id: "pay_1",
              valor: "49.90",
              data_pagamento:
                "2026-09-08T18:00:00.000Z"
            }
          ]
        });

        const pagamento =
          await repository
            .buscarPagamentoConfirmado({
              assinaturaId: 11,
              pagamentoId: "pay_1"
            });

        expect(pagamento)
          .toMatchObject({
            id: 30,
            valor: "49.90"
          });

        const sql =
          db.query.mock.calls[0][0];

        expect(sql).toContain(
          "p.data_pagamento IS NOT NULL"
        );
      }
    );
  }
);
