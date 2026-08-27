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
      "preserva sinais Google e tenta recuperar a sessão anterior ao cadastro",
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
          "NULLIF(BTRIM(gclid), '')"
        );
        expect(sql).toContain(
          "NULLIF(BTRIM(gbraid), '')"
        );
        expect(sql).toContain(
          "NULLIF(BTRIM(wbraid), '')"
        );
        expect(sql).toMatch(
          /COALESCE\([\s\S]*?gclid[\s\S]*?gbraid[\s\S]*?wbraid[\s\S]*?\) IS NOT NULL/i
        );
        expect(sql).toMatch(
          /COALESCE\([\s\S]*?gclid[\s\S]*?gbraid[\s\S]*?wbraid[\s\S]*?\) IS NULL/i
        );
        expect(sql).toContain(
          "jsonb_set"
        );
        expect(sql).toContain(
          "propriedades ->> 'gclid'"
        );
        expect(sql).toContain(
          "INNER JOIN eventos_produto e"
        );
        expect(sql).toContain(
          "u.created_at - INTERVAL '24 hours'"
        );
        expect(sql).toContain(
          "u.created_at + INTERVAL '24 hours'"
        );
        expect(sql).toContain(
          "mua_existente.intencao = 'profissional'"
        );
        expect(sql).toContain(
          "e.usuario_id IS NULL"
        );
        expect(sql).toContain(
          "e.sessao_id ="
        );
        expect(sql).toContain(
          "UPDATE marketing_usuario_atribuicoes mua"
        );
        expect(resultado).toMatchObject({
          campanhaOficialId: 42,
          atribuicoesComGclidPreservadas: 0,
          atribuicoesRecuperadasDeEventos: 0,
          eventosComGclidPreservados: 0,
        });
      }
    );
  }
);
