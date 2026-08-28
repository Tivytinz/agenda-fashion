jest.mock(
  "../src/repositories/adminProfessionalFunnelRepository",
  () => ({
    periodoSeguro: jest.fn((value) => value || "30"),
    listarPorCampanha: jest.fn(),
  })
);

const service = require(
  "../src/services/adminProfessionalFunnelService"
);

describe(
  "aliases históricos no funil profissional",
  () => {
    test(
      "consolida aliases oficiais do Google sem alterar a identidade observada",
      () => {
        const linhas =
          service.consolidarLinhasCampanha([
            {
              origem: "google",
              midia: "cpc",
              campanha: "aquisicao_profissionais",
              classificacao_atribuicao: "oficial",
              campanha_oficial_id: 101,
              cadastros: 8,
            },
            {
              origem: "google",
              midia: "cpc",
              campanha: "search_aquisicao_profissionais",
              classificacao_atribuicao: "oficial",
              campanha_oficial_id: 102,
              cadastros: 4,
            },
            {
              origem: "google",
              midia: "cpc",
              campanha: "google_ads_profissionais",
              classificacao_atribuicao: "oficial",
              campanha_oficial_id: 103,
              cadastros: 0,
              investimento_centavos: 20000,
            },
          ]);

        expect(linhas).toHaveLength(1);
        expect(linhas[0]).toMatchObject({
          origem: "google",
          midia: "cpc",
          campanha: "google_ads_profissionais",
          classificacao_atribuicao: "oficial",
          cadastros: 12,
          investimento_centavos: 20000,
        });
        expect(linhas[0].identidades_utm)
          .toEqual(
            expect.arrayContaining([
              {
                origem: "google",
                midia: "cpc",
                campanha: "aquisicao_profissionais",
              },
              {
                origem: "google",
                midia: "cpc",
                campanha: "search_aquisicao_profissionais",
              },
              {
                origem: "google",
                midia: "cpc",
                campanha: "google_ads_profissionais",
              },
            ])
          );
      }
    );
  }
);
