const {
  agruparPorCampanhaOficial,
  normalizarCampanhaOficial,
} = require(
  "../src/services/adminProfessionalRecurrenceCampaignService"
);

describe(
  "adminProfessionalRecurrenceCampaignService",
  () => {
    test(
      "agrupa somente atribuicoes oficiais pela campanha canonica",
      () => {
        const grupos =
          agruparPorCampanhaOficial([
            {
              classificacao_atribuicao: "oficial",
              campanha_oficial_id: "10",
              origem: "google",
              midia: "cpc",
              campanha: "google_ads_profissionais",
              metodo_resolucao: "utm_exata",
              usuario_id: 1,
            },
            {
              classificacao_atribuicao: "oficial",
              campanha_oficial_id: "10",
              origem: "google",
              midia: "cpc",
              campanha: "google_ads_profissionais",
              metodo_resolucao: "vinculo_plataforma",
              usuario_id: 2,
            },
            {
              classificacao_atribuicao:
                "rastreamento_incompleto",
              campanha_oficial_id: null,
              origem: "google",
              midia: "cpc",
              campanha: "(sem campanha)",
              usuario_id: 3,
            },
            {
              classificacao_atribuicao: "organico",
              campanha_oficial_id: null,
              origem: "instagram",
              midia: "social",
              campanha: "organico",
              usuario_id: 4,
            },
          ]);

        expect(grupos).toHaveLength(1);
        expect(grupos[0]).toMatchObject({
          chave: "campanha:10",
          campanhaOficialId: "10",
          origem: "google",
          midia: "cpc",
          campanha: "google_ads_profissionais",
          metodosResolucao: [
            "utm_exata",
            "vinculo_plataforma",
          ],
        });
        expect(
          grupos[0].linhas.map(
            (linha) => linha.usuario_id
          )
        ).toEqual([1, 2]);
      }
    );

    test(
      "nao promove linha sem campanha oficial mesmo quando marcada como oficial",
      () => {
        expect(
          normalizarCampanhaOficial({
            classificacao_atribuicao: "oficial",
            campanha_oficial_id: null,
            origem: "google",
            campanha: "google_ads_profissionais",
          })
        ).toBeNull();
      }
    );
  }
);
