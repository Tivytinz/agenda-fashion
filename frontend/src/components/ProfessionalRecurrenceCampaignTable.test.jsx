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
      "mostra qualidade e recorrencia madura da campanha oficial",
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
                janelasCandidatas: [
                  {
                    janelaDias: 7,
                    elegiveis: 3,
                    comSegundoNaJanela: 2,
                    taxaSegundoNaJanela: 66.67,
                    comTerceiroNaJanela: 1,
                    taxaTerceiroNaJanela: 33.33,
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
          screen.getByText(
            /somente campanhas que o backend conseguiu resolver como oficiais/i
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
      "trata ausencia de campanhas oficiais sem inventar dado",
      () => {
        render(
          <ProfessionalRecurrenceCampaignTable
            campanhas={[]}
          />
        );

        expect(
          screen.getByText(
            /ainda não há campanhas oficiais com profissionais/i
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            /ainda não há janelas maduras para campanhas oficiais/i
          )
        ).not.toBeNull();
      }
    );
  }
);
