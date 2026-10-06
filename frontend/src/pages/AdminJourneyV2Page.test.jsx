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
    reconciliacaoConversoesMarketing: {
      estado: "atencao",
      periodo: "30",
      provedores: [
        {
          provedor: "google",
          conversoesPagas: 4,
          elegiveisObservadas: 3,
          enviadas: 2,
          inelegiveisLegitimas: 1,
          emProcessamento: 0,
          perdasTecnicas: 0,
          semEntrega: 1,
          coberturaTecnica: 66.67
        }
      ],
      metodologia: "Pagamento confirmado permanece a fonte de verdade."
    },
    saudeConversoesMarketing: {
      estado: "atencao",
      periodoAtividade: "30",
      resumo: {
        total: 5,
        atividadePeriodo: 2,
        falhasTerminais: 1,
        processamentosExpirados: 0
      },
      provedores: [
        {
          provedor: "google",
          status: "SENT",
          total: 4,
          atividade_periodo: 1,
          pendencia_mais_antiga_em: null,
          ultimo_envio_em: "2026-10-06T12:00:00.000Z"
        },
        {
          provedor: "meta",
          status: "FAILED",
          total: 1,
          atividade_periodo: 1,
          pendencia_mais_antiga_em: "2026-10-06T11:00:00.000Z",
          ultimo_envio_em: null
        }
      ],
      metodologia: "Diagnóstico operacional da fila persistente."
    },
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

    expect(
      screen.getByRole(
        "heading",
        { name: "Saúde da entrega Google × Meta" }
      )
    ).not.toBeNull();
    expect(
      screen.getByRole(
        "heading",
        { name: "Pagamento → elegibilidade → Google / Meta" }
      )
    ).not.toBeNull();
    expect(screen.getByText("66,7%")).not.toBeNull();

    expect(screen.getByText("Atenção")).not.toBeNull();
    expect(screen.getByText("Falhas terminais")).not.toBeNull();
    expect(screen.getAllByText("Google").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Meta").length).toBeGreaterThan(0);



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
