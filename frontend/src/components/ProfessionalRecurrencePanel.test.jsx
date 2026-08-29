// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

vi.mock(
  "../api/client",
  () => ({
    apiRequest: vi.fn(),
  })
);

import { apiRequest } from "../api/client";
import { ProfessionalRecurrencePanel } from "./ProfessionalRecurrencePanel";

afterEach(cleanup);

describe(
  "ProfessionalRecurrencePanel",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(
      "usa o mesmo periodo e mostra repeticao, tempo, maturidade e janelas candidatas",
      async () => {
        apiRequest.mockResolvedValue({
          periodo: "7",
          resumo: {
            comPrimeiroAgendamento: 8,
            comSegundoAgendamento: 5,
            comTerceiroAgendamento: 3,
            taxaSegundoSobrePrimeiro: 62.5,
            taxaTerceiroSobreSegundo: 60,
            taxaTerceiroSobrePrimeiro: 37.5,
          },
          tempos: {
            primeiroParaSegundo: {
              amostra: 5,
              medianaDias: 2.5,
              p75Dias: 4,
            },
            segundoParaTerceiro: {
              amostra: 3,
              medianaDias: 5,
              p75Dias: 7.25,
            },
            maturidadeDesdePrimeiro: {
              amostra: 8,
              medianaDias: 12,
              p75Dias: 18.5,
              minimoDias: 1,
              maximoDias: 31,
            },
          },
          janelasCandidatas: [
            {
              janelaDias: 7,
              elegiveis: 6,
              comSegundoNaJanela: 4,
              taxaSegundoNaJanela: 66.67,
              comTerceiroNaJanela: 2,
              taxaTerceiroNaJanela: 33.33,
            },
            {
              janelaDias: 14,
              elegiveis: 4,
              comSegundoNaJanela: 3,
              taxaSegundoNaJanela: 75,
              comTerceiroNaJanela: 2,
              taxaTerceiroNaJanela: 50,
            },
            {
              janelaDias: 30,
              elegiveis: 1,
              comSegundoNaJanela: 1,
              taxaSegundoNaJanela: 100,
              comTerceiroNaJanela: 1,
              taxaTerceiroNaJanela: 100,
            },
          ],
        });

        render(
          <ProfessionalRecurrencePanel
            period="7"
          />
        );

        await waitFor(() => {
          expect(apiRequest)
            .toHaveBeenCalledWith(
              "/admin/marketing/recorrencia-profissionais?periodo=7",
              expect.objectContaining({
                signal: expect.any(AbortSignal),
              })
            );
        });

        expect(
          screen.getByRole("row", {
            name: "Primeiro agendamento 8 100%"
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: "Segundo agendamento 5 62.5%"
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: "Terceiro agendamento 3 60%"
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: "1º → 2º agendamento 5 2,5 dias 4 dias"
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: "2º → 3º agendamento 3 5 dias 7,25 dias"
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: "D7 6 4 66.67% 2 33.33%"
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: "D30 1 1 100% 1 100%"
          })
        ).not.toBeNull();
        expect(
          screen.getByText(
            /só entram como elegíveis profissionais cujo primeiro agendamento já tem idade suficiente/i
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            /maturidade observada desde o primeiro agendamento/i
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            /momento em que cada agendamento foi criado no AF/i
          )
        ).not.toBeNull();
        expect(
          screen.getByText(
            /não é retenção D30/i
          )
        ).not.toBeNull();
      }
    );

    it(
      "explica quando o primeiro valor ainda nao se repetiu e nao inventa tempo",
      async () => {
        apiRequest.mockResolvedValue({
          resumo: {
            comPrimeiroAgendamento: 4,
            comSegundoAgendamento: 0,
            comTerceiroAgendamento: 0,
          },
          tempos: {
            primeiroParaSegundo: {
              amostra: 0,
              medianaDias: null,
              p75Dias: null,
            },
            segundoParaTerceiro: {
              amostra: 0,
              medianaDias: null,
              p75Dias: null,
            },
            maturidadeDesdePrimeiro: {
              amostra: 4,
              medianaDias: 3,
              p75Dias: 4,
              minimoDias: 1,
              maximoDias: 5,
            },
          },
          janelasCandidatas: [
            {
              janelaDias: 7,
              elegiveis: 0,
              comSegundoNaJanela: 0,
              taxaSegundoNaJanela: 0,
              comTerceiroNaJanela: 0,
              taxaTerceiroNaJanela: 0,
            },
          ],
        });

        render(
          <ProfessionalRecurrencePanel />
        );

        expect(
          await screen.findByText(
            /ainda não repetiram o valor pela segunda vez/i
          )
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: "1º → 2º agendamento 0 Sem base Sem base"
          })
        ).not.toBeNull();
        expect(
          screen.getByRole("row", {
            name: "D7 0 0 0% 0 0%"
          })
        ).not.toBeNull();
      }
    );
  }
);
