jest.mock(
  "../src/db/db",
  () => ({
    executarTransacao:
      jest.fn(),
  })
);

const db = require(
  "../src/db/db"
);

const service = require(
  "../src/services/marketingCanonicalCleanupService"
);

describe(
  "limpeza canônica de marketing",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "preserva GCLID ao retirar campanha Google legada",
      async () => {
        const consultas = [];
        let chamada = 0;

        const client = {
          query: jest.fn(
            async (sql) => {
              consultas.push(sql);
              chamada += 1;

              if (chamada === 1) {
                return {
                  rows: [{ id: 42 }],
                  rowCount: 1,
                };
              }

              if (chamada === 2) {
                return {
                  rows: [],
                  rowCount: 0,
                };
              }

              return {
                rows: [],
                rowCount: 0,
              };
            }
          ),
        };

        db.executarTransacao
          .mockImplementation(
            (callback) => callback(client)
          );

        const resultado =
          await service
            .executarLimpezaGoogleProfissionais();

        const sql =
          consultas.join("\n");

        expect(sql).toContain(
          "NULLIF(BTRIM(gclid), '') IS NOT NULL"
        );
        expect(sql).toContain(
          "AND NULLIF(BTRIM(gclid), '') IS NULL"
        );
        expect(sql).toContain(
          "jsonb_set"
        );
        expect(sql).toContain(
          "propriedades ->> 'gclid'"
        );
        expect(resultado).toMatchObject({
          campanhaOficialId: 42,
          atribuicoesComGclidPreservadas: 0,
          eventosComGclidPreservados: 0,
        });
      }
    );
  }
);
