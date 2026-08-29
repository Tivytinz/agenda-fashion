// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  ProfessionalRecurrenceMonetizationTable,
} from "./ProfessionalRecurrenceMonetizationTable";

afterEach(cleanup);

describe(
  "ProfessionalRecurrenceMonetizationTable",
  () => {
    it(
      "mostra associação madura sem promover causalidade ou retorno financeiro",
      () => {
        render(
          <ProfessionalRecurrenceMonetizationTable
            diagnostico={{
              diasMaturacaoAtivacao: 14,
              diasMaturacaoMonetizacao: 21,
            }}
            campanhas={[
              {
                chave: "campanha:10",
                campanhaOficialId: "10",
                campanha:
                  "google_ads_profissionais",
                monetizacaoRecorrencia: [
                  {
                    janelaDias: 14,
                    diasMaturidadeNecessarios: 28,
                    profissionaisMaduros: 12,
                    assinaturasNaMonetizacao: 3,
                    taxaAssinaturaBaseMadura: 25,
                    comSegundoNaJanela: 6,
                    assinaturasEntreSegundo: 2,
                    taxaAssinaturaEntreSegundo: 33.33,
                    comTerceiroNaJanela: 3,
                    assinaturasEntreTerceiro: 1,
                    taxaAssinaturaEntreTerceiro: 33.33,
                    minimoCadastrosReguaOperacional: 10,
                    baseAbaixoReguaOperacional: false,
                  },
                ],
              },
            ]}
          />
        );

        expect(
          screen.getByRole("row", {
            name: /google_ads_profissionais D14 28 dias 12 3 25% 6 2 33,33% 3 1 33,33% Base acima da régua operacional/i,
          })
        ).not.toBeNull();
        expect(
          screen.getByText(
            /não prova que a recorrência causou a assinatura/i
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            /não é retenção oficial, LTV, payback ou ROAS/i
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            /não pagar nessa janela também não significa ausência de valor/i
          )
        ).not.toBeNull();
      }
    );

    it(
      "explicita ausência de denominador e amostra abaixo da régua",
      () => {
        render(
          <ProfessionalRecurrenceMonetizationTable
            diagnostico={{
              diasMaturacaoAtivacao: 14,
              diasMaturacaoMonetizacao: 21,
            }}
            campanhas={[
              {
                chave: "campanha:20",
                campanhaOficialId: "20",
                campanha: "meta_profissionais",
                monetizacaoRecorrencia: [
                  {
                    janelaDias: 30,
                    diasMaturidadeNecessarios: 44,
                    profissionaisMaduros: 2,
                    assinaturasNaMonetizacao: 0,
                    taxaAssinaturaBaseMadura: 0,
                    comSegundoNaJanela: 0,
                    assinaturasEntreSegundo: 0,
                    taxaAssinaturaEntreSegundo: null,
                    comTerceiroNaJanela: 0,
                    assinaturasEntreTerceiro: 0,
                    taxaAssinaturaEntreTerceiro: null,
                    minimoCadastrosReguaOperacional: 10,
                    baseAbaixoReguaOperacional: true,
                  },
                ],
              },
            ]}
          />
        );

        expect(
          screen.getByRole("row", {
            name: /meta_profissionais D30 44 dias 2 0 0% 0 0 Sem base 0 0 Sem base Abaixo da régua operacional \(10 cadastros\)/i,
          })
        ).not.toBeNull();
      }
    );

    it(
      "trata estado vazio sem inventar monetização",
      () => {
        render(
          <ProfessionalRecurrenceMonetizationTable
            campanhas={[]}
          />
        );

        expect(
          screen.getByText(
            /ainda não há campanhas oficiais com coorte madura suficiente/i
          )
        ).not.toBeNull();
      }
    );
  }
);
