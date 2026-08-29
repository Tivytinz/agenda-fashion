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
  ProfessionalRecurrenceAcquisitionTable,
} from "./ProfessionalRecurrenceAcquisitionTable";

afterEach(cleanup);

describe(
  "ProfessionalRecurrenceAcquisitionTable",
  () => {
    it(
      "separa Google Ads oficial, organico e sem evidencia",
      () => {
        render(
          <ProfessionalRecurrenceAcquisitionTable
            origens={[
              {
                chave: "oficial:google",
                classificacaoAtribuicao: "oficial",
                origem: "google",
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
              {
                chave: "organico:instagram",
                classificacaoAtribuicao: "organico",
                origem: "instagram",
                profissionais: 2,
                comPrimeiroAgendamento: 1,
                taxaPrimeiroSobreProfissionais: 50,
                comSegundoAgendamento: 1,
                taxaSegundoSobrePrimeiro: 100,
                comTerceiroAgendamento: 0,
                taxaTerceiroSobrePrimeiro: 0,
                janelasCandidatas: [],
              },
              {
                chave: "sem_evidencia:sem_evidencia",
                classificacaoAtribuicao: "sem_evidencia",
                origem: "sem_evidencia",
                profissionais: 1,
                comPrimeiroAgendamento: 0,
                taxaPrimeiroSobreProfissionais: 0,
                comSegundoAgendamento: 0,
                taxaSegundoSobrePrimeiro: 0,
                comTerceiroAgendamento: 0,
                taxaTerceiroSobrePrimeiro: 0,
                janelasCandidatas: [],
              },
            ]}
          />
        );

        expect(
          screen.getByRole("row", {
            name: "Google Ads Oficial 4 3 75% 2 66.67% 1 33.33%"
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: "Instagram · orgânico Orgânico 2 1 50% 1 100% 0 0%"
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: "Sem evidência de origem Sem evidência 1 0 0% 0 0% 0 0%"
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: "Google Ads D7 3 2 66.67% 1 33.33%"
          })
        ).not.toBeNull();
        expect(
          screen.getByText(
            /não transforma origem incompleta em atribuição oficial/i
          )
        ).not.toBeNull();
      }
    );

    it(
      "trata ausencia de origem e de janelas maduras",
      () => {
        render(
          <ProfessionalRecurrenceAcquisitionTable
            origens={[]}
          />
        );

        expect(
          screen.getByText(
            /ainda não há profissionais com origem disponível/i
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            /ainda não há janelas maduras por origem/i
          )
        ).not.toBeNull();
      }
    );
  }
);
