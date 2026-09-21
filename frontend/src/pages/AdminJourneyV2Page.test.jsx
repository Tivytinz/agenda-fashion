// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  within
} from "@testing-library/react";
import {
  MemoryRouter
} from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { apiRequest } from "../api/client";
import {
  AdminJourneyV2Page
} from "./AdminAnalyticsV2Pages";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue({
    periodo: "30",
    telas: [
      {
        page_key: "business_profile",
        route_template: "/negocio/:slug",
        visualizacoes: 10,
        sessoes: 8,
        tempo_medio_segundos: 22
      }
    ],
    transicoes: [],
    eventos: [],
    dispositivos: [],
    reconciliacaoPipelines: {
      estado: "divergencia_observada",
      inicioComparavel:
        "2026-09-20T12:00:00.000Z",
      eventos: [
        {
          evento: "profile_viewed",
          legadoComparavel: 10,
          v2Comparavel: 9,
          diferencaEventos: -1,
          coberturaV2SobreLegado: 90,
          bookingCompletedVinculados: 0
        },
        {
          evento: "booking_completed",
          legadoComparavel: 4,
          v2Comparavel: 4,
          diferencaEventos: 0,
          coberturaV2SobreLegado: 100,
          bookingCompletedVinculados: 4
        }
      ],
      metodologia: {
        comparacao:
          "Compara apenas a janela equivalente.",
        eventos:
          "Mapeia eventos equivalentes.",
        decisao:
          "Paridade não remove o legado automaticamente."
      }
    }
  });
});

afterEach(cleanup);

describe("jornada administrativa v2", () => {
  it("expõe divergência entre legado e V2 sem somar pipelines", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/admin/jornada?periodo=30"
        ]}
      >
        <AdminJourneyV2Page />
      </MemoryRouter>
    );

    await screen.findByRole(
      "heading",
      { name: "Jornada" }
    );

    expect(apiRequest).toHaveBeenCalledWith(
      "/admin/analytics-v2/journey?periodo=30",
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );

    expect(
      screen.getByRole(
        "heading",
        { name: "Reconciliação legado × V2" }
      )
    ).not.toBeNull();
    expect(
      screen.getByText(/Divergência observada/)
    ).not.toBeNull();

    const profileRow =
      screen.getByText(
        "Perfil visualizado"
      ).closest("tr");
    expect(
      within(profileRow)
        .getAllByRole("cell")
        .map((cell) => cell.textContent)
    ).toEqual([
      "Perfil visualizado",
      "10",
      "9",
      "-1",
      "90%"
    ]);

    const bookingRow =
      screen.getByText(
        "Agendamento concluído"
      ).closest("tr");
    expect(
      within(bookingRow).getByText(
        /4 conclusão\(ões\) V2 vinculada/
      )
    ).not.toBeNull();
  });
});
