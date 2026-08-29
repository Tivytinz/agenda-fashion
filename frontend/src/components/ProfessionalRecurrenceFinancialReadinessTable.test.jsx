import {
  render,
  screen,
} from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  ProfessionalRecurrenceFinancialReadinessTable,
} from "./ProfessionalRecurrenceFinancialReadinessTable";

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
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "google_ads_profissionais"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(/R\$\s*120,00/)
        ).toBeInTheDocument();
        expect(
          screen.getByText("2/2 atingido")
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "Leitura conjunta disponível"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            /não significa que a campanha deve escalar, manter ou pausar/i
          )
        ).toBeInTheDocument();
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
        ).toBeInTheDocument();
        expect(
          screen.getByText("0/2")
        ).toBeInTheDocument();
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
        ).toBeInTheDocument();
      }
    );
  }
);
