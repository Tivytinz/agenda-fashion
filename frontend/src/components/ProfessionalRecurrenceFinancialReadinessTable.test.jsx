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
  test,
} from "vitest";
import {
  ProfessionalRecurrenceFinancialReadinessTable,
} from "./ProfessionalRecurrenceFinancialReadinessTable";

afterEach(cleanup);

describe(
  "ProfessionalRecurrenceFinancialReadinessTable",
  () => {
    test(
      "exibe base madura comparável sem transformar prontidão em decisão de orçamento",
      () => {
        render(
          <ProfessionalRecurrenceFinancialReadinessTable
            campanhas={[
              {
                chave: "campanha:10",
                campanhaOficialId: "10",
                campanha:
                  "google_ads_profissionais",
                prontidaoFinanceiraRecorrencia: [
                  {
                    janelaDias: 7,
                    diasMaturidadeFinanceira: 21,
                    investimentoMaduroCentavos:
                      12000,
                    profissionaisMadurosComGasto:
                      12,
                    comSegundoNaJanela: 6,
                    comTerceiroNaJanela: 3,
                    assinaturasNaMonetizacao: 2,
                    minimoAssinaturasReguaRoas: 2,
                    atingiuMinimoAssinaturasReguaRoas:
                      true,
                    leitura: {
                      codigo:
                        "leitura_conjunta_disponivel",
                    },
                  },
                ],
              },
            ]}
          />
        );

        expect(
          screen.getByText(
            "Prontidão da leitura financeira conjunta"
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            "google_ads_profissionais"
          )
        ).not.toBeNull();
        expect(
          screen.getByText(/R\$\s*120,00/)
        ).not.toBeNull();
        expect(
          screen.getByText("2/2 atingido")
        ).not.toBeNull();
        expect(
          screen.getByText(
            "Leitura conjunta disponível"
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            /não significa que a campanha deve escalar, manter ou pausar/i
          )
        ).not.toBeNull();
      }
    );

    test(
      "mantem bloqueio de atribuição explícito",
      () => {
        render(
          <ProfessionalRecurrenceFinancialReadinessTable
            campanhas={[
              {
                chave: "campanha:20",
                campanha: "meta_profissionais",
                prontidaoFinanceiraRecorrencia: [
                  {
                    janelaDias: 14,
                    diasMaturidadeFinanceira: 28,
                    investimentoMaduroCentavos:
                      8000,
                    profissionaisMadurosComGasto: 4,
                    comSegundoNaJanela: 2,
                    comTerceiroNaJanela: 1,
                    assinaturasNaMonetizacao: 0,
                    minimoAssinaturasReguaRoas: 2,
                    atingiuMinimoAssinaturasReguaRoas:
                      false,
                    leitura: {
                      codigo:
                        "atribuicao_paga_incompleta",
                    },
                  },
                ],
              },
            ]}
          />
        );

        expect(
          screen.getByText(
            "Atribuição paga incompleta"
          )
        ).not.toBeNull();
        expect(
          screen.getByText("0/2")
        ).not.toBeNull();
      }
    );

    test(
      "exibe estado vazio sem inventar prontidão",
      () => {
        render(
          <ProfessionalRecurrenceFinancialReadinessTable />
        );

        expect(
          screen.getByText(
            /ainda não há campanhas com base suficiente/i
          )
        ).not.toBeNull();
      }
    );
  }
);
