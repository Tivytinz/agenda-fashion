const repository = require(
  "../src/repositories/marketingAttributionRecoveryRepository"
);

describe(
  "recuperação da atribuição de marketing",
  () => {
    test(
      "preserva a UTM observada ao recuperar uma atribuição vazia",
      async () => {
        let consulta = "";
        let parametros = null;
        const client = {
          query: jest.fn(
            async (sql, params) => {
              consulta = sql;
              parametros = params;
              return {
                rows: [],
                rowCount: 0,
              };
            }
          ),
        };

        await repository
          .recuperarGoogleProfissionaisPorEventos({
            client,
            campanhaOficial:
              "google_ads_profissionais",
            campanhasAceitas: [
              "google_ads_profissionais",
              "aquisicao_profissionais",
            ],
          });

        expect(consulta).toMatch(
          /NULLIF\([\s\S]*?e\.propriedades ->> 'utm_campaign'[\s\S]*?\) AS utm_campaign/i
        );
        expect(consulta).not.toMatch(
          /WHEN LOWER\([\s\S]*?utm_campaign[\s\S]*?THEN \$1/i
        );
        expect(consulta).toContain(
          "UPDATE marketing_usuario_atribuicoes mua"
        );
        expect(consulta).toContain(
          "= ANY($1::TEXT[])"
        );
        expect(parametros).toEqual([
          [
            "google_ads_profissionais",
            "aquisicao_profissionais",
          ],
        ]);
      }
    );
  }
);
