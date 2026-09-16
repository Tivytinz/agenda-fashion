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
