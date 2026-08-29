// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen
} from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it
} from "vitest";

import {
  ProfessionalRecurrenceCampaignTable,
} from "./ProfessionalRecurrenceCampaignTable";

afterEach(cleanup);

describe(
  "ProfessionalRecurrenceCampaignTable",
  () => {
    it(
      "mostra qualidade, recorrencia madura e custo observado da campanha oficial",
      () => {
        render(
          <ProfessionalRecurrenceCampaignTable
            campanhas={[
              {
                chave: "campanha:10",
                campanhaOficialId: "10",
                origem: "google",
                midia: "cpc",
                campanha: "google_ads_profissionais",
                metodosResolucao: [
                  "utm_exata",
                  "vinculo_plataforma",
                ],
                profissionais: 4,
                comPrimeiroAgendamento: 3,
                taxaPrimeiroSobreProfissionais: 75,
                comSegundoAgendamento: 2,
                taxaSegundoSobrePrimeiro: 66.67,
                comTerceiroAgendamento: 1,
                taxaTerceiroSobrePrimeiro: 33.33,
                investimentoCentavos: 12000,
                diasComGasto: 3,
                custoObservadoPorProfissionalCentavos: 3000,
                custoObservadoPrimeiroAgendamentoCentavos: 4000,
                leituraCusto:
                  "observado_medicao_incompleta",
                medicaoCusto: {
                  coberturaAtribuicaoPaga: 80,
                  pagosSemAtribuicaoOficial: 1,
                  profissionaisSemEvidencia: 2,
                },
                janelasCandidatas: [
                  {
                    janelaDias: 7,
                    elegiveis: 3,
                    comSegundoNaJanela: 2,
                    taxaSegundoNaJanela: 66.67,
                    comTerceiroNaJanela: 1,
                    taxaTerceiroNaJanela: 33.33,
                  },
                  {
                    janelaDias: 14,
                    elegiveis: 0,
                    comSegundoNaJanela: 0,
                    taxaSegundoNaJanela: 0,
                    comTerceiroNaJanela: 0,
                    taxaTerceiroNaJanela: 0,
                  },
                ],
              },
            ]}
          />
        );

        expect(
          screen.getByRole("row", {
            name: "google_ads_profissionais Google Ads UTM exata, Vínculo da plataforma 4 3 75% 2 66.67% 1 33.33%"
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: "google_ads_profissionais D7 3 2 66.67% 1 33.33%"
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: /google_ads_profissionais.*120,00.*3.*4.*30,00.*3.*40,00.*66.67%.*sem base madura.*observado com atribuição incompleta/i,
          })
        ).not.toBeNull();
        expect(
          screen.getByText(
            /80% de cobertura entre sinais pagos classificáveis/i
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            /não calculamos custo por recorrente/i
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            /não calcula CAC, ROAS ou receita/i
          )
        ).not.toBeNull();
      }
    );

    it(
      "explicita investimento sem profissional oficialmente atribuido",
      () => {
        render(
          <ProfessionalRecurrenceCampaignTable
            campanhas={[
              {
                chave: "campanha:20",
                campanhaOficialId: "20",
                origem: "meta",
                campanha: "meta_profissionais",
                metodosResolucao: [],
                profissionais: 0,
                comPrimeiroAgendamento: 0,
                investimentoCentavos: 8000,
                diasComGasto: 2,
                custoObservadoPorProfissionalCentavos: null,
                custoObservadoPrimeiroAgendamentoCentavos: null,
                leituraCusto:
                  "investimento_sem_profissional_atribuido",
                medicaoCusto: {
                  coberturaAtribuicaoPaga: null,
                  pagosSemAtribuicaoOficial: 0,
                  profissionaisSemEvidencia: 0,
                },
                janelasCandidatas: [],
              },
            ]}
          />
        );

        expect(
          screen.getByRole("row", {
            name: /meta_profissionais.*80,00.*2.*0.*sem base.*0.*sem base.*sem base madura.*gasto sem profissional atribuído/i,
          })
        ).not.toBeNull();
        expect(
          screen.getByText(
            /sem profissional atribuído/i
          )
        ).not.toBeNull();
      }
    );

    it(
      "trata ausencia de campanhas oficiais sem inventar dado",
      () => {
        render(
          <ProfessionalRecurrenceCampaignTable
            campanhas={[]}
          />
        );

        expect(
          screen.getByText(
            /ainda não há campanhas oficiais com profissionais ou investimento/i
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            /ainda não há janelas maduras para campanhas oficiais/i
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            /ainda não há campanhas profissionais oficiais ou investimento/i
          )
        ).not.toBeNull();
      }
    );
  }
);
