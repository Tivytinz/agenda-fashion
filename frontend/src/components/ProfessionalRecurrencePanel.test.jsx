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
      "usa o mesmo periodo do funil e mostra a repeticao ate o terceiro agendamento",
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
          screen.getByText(
            /não é retenção D30/i
          )
        ).not.toBeNull();
      }
    );

    it(
      "explica quando o primeiro valor ainda nao se repetiu",
      async () => {
        apiRequest.mockResolvedValue({
          resumo: {
            comPrimeiroAgendamento: 4,
            comSegundoAgendamento: 0,
            comTerceiroAgendamento: 0,
          },
        });

        render(
          <ProfessionalRecurrencePanel />
        );

        expect(
          await screen.findByText(
            /ainda não repetiram o valor pela segunda vez/i
          )
        ).not.toBeNull();
      }
    );
  }
);
