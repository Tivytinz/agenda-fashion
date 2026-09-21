// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { AdminRetentionV2Page } from "./AdminAnalyticsV2Pages";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

const RESULT = {
  periodo: "30",
  resumo: {
    comPrimeiroAgendamento: 20,
    comSegundoAgendamento: 8,
    comTerceiroAgendamento: 3,
    taxaSegundoSobrePrimeiro: 40,
    taxaTerceiroSobrePrimeiro: 15
  },
  tempos: {
    primeiroParaSegundo: {
      amostra: 8,
      medianaDias: 6.5
    }
  },
  janelasCandidatas: [
    {
      janelaDias: 7,
      elegiveis: 10,
      comSegundoNaJanela: 4,
      taxaSegundoNaJanela: 40
    },
    {
      janelaDias: 30,
      elegiveis: 20,
      comSegundoNaJanela: 8,
      taxaSegundoNaJanela: 40
    }
  ],
  coortesSemanais: [
    {
      semanaCadastro: "2026-08-31",
      profissionais: 12,
      comPrimeiroAgendamento: 6,
      taxaPrimeiroSobreProfissionais: 50
    }
  ],
  metodologia: {
    criterio: "Agendamentos cancelados não contam.",
    janelas: "Somente profissionais maduros entram em cada janela.",
    observacao: "Recorrência não confirma atendimento realizado ou receita."
  }
};

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function renderPage(initialEntry = "/admin/retencao?periodo=30") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AdminRetentionV2Page />
      <LocationProbe />
    </MemoryRouter>
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue(RESULT);
});

afterEach(cleanup);

describe("retenção administrativa v2", () => {
  it("mostra recorrência, maturidade e coortes sem misturar os marcos", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Retenção" });
    expect(apiRequest).toHaveBeenCalledWith(
      "/admin/analytics-v2/retention?periodo=30",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    expect(screen.getByText("20")).not.toBeNull();
    expect(screen.getByText("8")).not.toBeNull();
    expect(screen.getByText("3")).not.toBeNull();
    expect(screen.getByText("6.5 dias")).not.toBeNull();

    const d7 = screen.getByText("D7").closest("article");
    expect(within(d7).getByText("40%")).not.toBeNull();
    expect(within(d7).getByText(/4 de 10 maduros/)).not.toBeNull();

    const cohortRow = screen.getByText("2026-08-31").closest("tr");
    expect(within(cohortRow).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "2026-08-31",
      "12",
      "6",
      "50%"
    ]);
  });

  it("trata amostra vazia sem inventar recorrência", async () => {
    apiRequest.mockResolvedValue({
      periodo: "30",
      resumo: {},
      tempos: { primeiroParaSegundo: {} },
      janelasCandidatas: [],
      coortesSemanais: [],
      metodologia: {}
    });

    renderPage();

    await screen.findByRole("heading", { name: "Retenção" });
    expect(screen.getByText("Amostra insuficiente.")).not.toBeNull();
    expect(screen.getByText("Sem coortes no período")).not.toBeNull();
    expect(screen.queryByText("100%")).toBeNull();
  });

  it("mostra sem base madura em vez de zero por cento quando o denominador está vazio", async () => {
    apiRequest.mockResolvedValue({
      periodo: "30",
      resumo: {},
      tempos: {
        primeiroParaSegundo: {
          amostra: 0,
          medianaDias: null
        }
      },
      janelasCandidatas: [
        {
          janelaDias: 30,
          elegiveis: 0,
          comSegundoNaJanela: 0,
          taxaSegundoNaJanela: null
        }
      ],
      coortesSemanais: [],
      metodologia: {}
    });

    renderPage();

    await screen.findByRole("heading", { name: "Retenção" });
    const d30 = screen.getByText("D30").closest("article");

    expect(within(d30).getByText("—")).not.toBeNull();
    expect(
      within(d30).getByText("Sem base madura nesta janela")
    ).not.toBeNull();
    expect(within(d30).queryByText("0%")).toBeNull();
  });

  it("exibe qualidade de aquisição e prontidão financeira da análise avançada", async () => {
    apiRequest.mockResolvedValue({
      ...RESULT,
      qualidadeAquisicao: [
        {
          chave: "oficial:google",
          classificacaoAtribuicao: "oficial",
          origem: "google",
          profissionais: 11,
          comPrimeiroAgendamento: 6,
          comSegundoAgendamento: 4,
          comTerceiroAgendamento: 2
        }
      ],
      diagnosticoCustoAquisicao: {
        profissionaisOficiais: 11,
        coberturaAtribuicaoPaga: 100,
        pagosSemAtribuicaoOficial: 0,
        profissionaisSemEvidencia: 0,
        medicaoIncompleta: false
      },
      qualidadeCampanhasOficiais: [
        {
          chave: "campanha:987",
          campanha: "profissionais_goias_reconciliada",
          origem: "google",
          midia: "cpc",
          profissionais: 11,
          comPrimeiroAgendamento: 6,
          comSegundoAgendamento: 4,
          investimentoCentavos: 22000,
          custoObservadoPrimeiroAgendamentoCentavos: 3667,
          prontidaoFinanceiraRecorrencia: [
            {
              janelaDias: 7,
              leitura: {
                rotulo: "Leitura conjunta disponível"
              }
            }
          ]
        }
      ]
    });

    renderPage();

    await screen.findByRole("heading", { name: "Retenção" });
    expect(
      screen.getByRole("heading", { name: "Recorrência por origem" })
    ).not.toBeNull();
    expect(
      screen.getByText("profissionais_goias_reconciliada")
    ).not.toBeNull();
    expect(
      screen.getByText("Leitura conjunta disponível")
    ).not.toBeNull();
  });

  it("troca o período pela URL e mantém os últimos dados válidos se a atualização falhar", async () => {
    renderPage("/admin/retencao?periodo=30");
    await screen.findByText("2026-08-31");

    apiRequest.mockRejectedValue(new Error("Falha ao consultar retenção."));
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));

    expect((await screen.findByRole("alert")).textContent).toContain("últimos dados válidos");
    expect(screen.getByText("2026-08-31")).not.toBeNull();
    expect(screen.getByTestId("location").textContent).toBe("?periodo=7");
    expect(screen.getByLabelText("Recorte temporal").textContent).toContain("30 dias");
  });
});
