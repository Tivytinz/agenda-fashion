const repository = require(
  "../src/repositories/marketingCanonicalCleanupRepository"
);

describe(
  "repositório de canonicalização de marketing",
  () => {
    test(
      "garante campanha e aliases sem apagar evidência ou histórico",
      async () => {
        const consultas = [];
        const parametros = [];
        const client = {
          query: jest.fn(
            async (sql, params) => {
              consultas.push(sql);
              parametros.push(params);

              if (consultas.length === 1) {
                return {
                  rows: [{ id: 91 }],
                  rowCount: 1,
                };
              }

              return {
                rows: [],
                rowCount: 3,
              };
            }
          ),
        };

        const resultado =
          await repository
            .garantirCampanhaGoogleProfissionais({
              client,
              campanhaOficial:
                "google_ads_profissionais",
            });

        const sql =
          consultas.join("\n");

        expect(resultado.rows[0].id)
          .toBe(91);
        expect(sql).toContain(
          "INSERT INTO marketing_campanhas"
        );
        expect(sql).toContain(
          "ON CONFLICT"
        );
        expect(sql).toContain(
          "'/para-profissionais'"
        );
        expect(sql).toContain(
          "UNNEST($1::TEXT[])"
        );
        expect(parametros[1][0])
          .toEqual([
            "aquisicao_profissionais",
            "search_aquisicao_profissionais",
            "profissionais_google_ads",
          ]);

        [
          "UPDATE marketing_usuario_atribuicoes",
          "UPDATE eventos_produto",
          "DELETE FROM marketing_campanha_gastos",
          "DELETE FROM marketing_campanha_vinculos",
          "DELETE FROM marketing_campanhas",
        ].forEach((trechoDestrutivo) => {
          expect(sql).not.toContain(
            trechoDestrutivo
          );
        });
      }
    );
  }
);
