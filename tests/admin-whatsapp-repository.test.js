const mockQuery = jest.fn();

jest.mock("../src/db/db", () => ({
  query: mockQuery,
}));

const repository = require(
  "../src/repositories/adminWhatsAppRepository"
);

describe(
  "métricas administrativas do WhatsApp",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockQuery.mockResolvedValue({
        rows: [],
      });
    });

    test(
      "calcula o funil por tipo usando eventos persistidos",
      async () => {
        await repository
          .buscarMetricasPorTemplate(
            "30"
          );

        const [sql, parametros] =
          mockQuery.mock.calls[0];

        expect(parametros)
          .toEqual(["30"]);
        expect(sql)
          .toMatch(/GROUP BY tipo/i);
        expect(sql)
          .toMatch(/meta_message_id IS NOT NULL/i);
        expect(sql)
          .toMatch(/entregue_em IS NOT NULL/i);
        expect(sql)
          .toMatch(/lida_em IS NOT NULL/i);
        expect(sql)
          .toMatch(/falhou_em IS NOT NULL/i);
        expect(sql)
          .toMatch(/INTERVAL '30 days'/i);
      }
    );
  }
);
