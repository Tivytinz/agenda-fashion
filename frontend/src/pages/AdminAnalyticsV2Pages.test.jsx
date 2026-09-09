// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { AdminAcquisitionV2Page } from "./AdminAnalyticsV2Pages";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

const RESULT = {
  periodo: "7",
  sessoesPorOrigem: [{ canal: "paid_search", source: "google", medium: "cpc", campanha_nome: "Profissionais GO", sessoes: 100, usuarios: 70, tempo_engajado_ms: 60000 }],
  funilPorCampanha: [{ campanha: "Beleza GO", origem: "google", midia: "cpc", cadastros: 10, negociosPublicados: 6, primeirosAgendamentos: 3, assinaturasAtivadas: 1, investimentoCentavos: 5000, cacAssinanteCentavos: null, roas: null }],
  qualidadeMensuracao: { prontaParaDecisao: false, bloqueios: [{ codigo: "sem_evidencia", mensagem: "Existem cadastros sem evidência de origem." }] }
};

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function renderPage() {
  render(<MemoryRouter initialEntries={["/admin/aquisicao?periodo=7"]}><AdminAcquisitionV2Page /><LocationProbe /></MemoryRouter>);
}

beforeEach(() => { apiRequest.mockReset(); apiRequest.mockResolvedValue(RESULT); });
afterEach(cleanup);

describe("aquisição administrativa v2", () => {
  it("separa sessões, publicação, primeiro agendamento e pagamento sem gate de agenda", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Aquisição" });
    expect(screen.getByText("Profissionais GO")).not.toBeNull();
    const row = screen.getByText("Beleza GO").closest("tr");
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Beleza GOgoogle / cpc", "10", "6", "3", "1", "—", "—"
    ]);
    expect(screen.queryByRole("columnheader", { name: /Agenda configurada|Pós-agenda/ })).toBeNull();
    expect(screen.getByText("Existem cadastros sem evidência de origem.")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Não use este recorte para escalar orçamento ainda" })).not.toBeNull();
  });

  it("mantém CAC e ROAS calculados pelo backend", async () => {
    apiRequest.mockResolvedValue({ ...RESULT, funilPorCampanha: [{ ...RESULT.funilPorCampanha[0], cacAssinanteCentavos: 3456, roas: 1.23 }] });
    renderPage();
    const row = (await screen.findByText("Beleza GO")).closest("tr");
    expect(within(row).getByText(/R\$\s*34,56/)).not.toBeNull();
    expect(within(row).getByText("1.23x")).not.toBeNull();
  });

  it("identifica ausência de amostra sem inventar conversão", async () => {
    apiRequest.mockResolvedValue({ periodo: "7", sessoesPorOrigem: [], funilPorCampanha: [] });
    renderPage();
    expect(await screen.findByText("Nenhuma coorte atribuída neste período")).not.toBeNull();
    expect(screen.getByText("Ainda não há sessões first-party neste recorte")).not.toBeNull();
    expect(screen.queryByText("100%")).toBeNull();
  });

  it("recarrega o período e persiste a seleção na URL", async () => {
    renderPage();
    await screen.findByText("Beleza GO");
    apiRequest.mockResolvedValue({ ...RESULT, periodo: "30", funilPorCampanha: [] });
    fireEvent.click(screen.getByRole("button", { name: "30 dias" }));
    await screen.findByText("Nenhuma coorte atribuída neste período");
    expect(apiRequest).toHaveBeenLastCalledWith("/admin/analytics-v2/acquisition?periodo=30", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByTestId("location").textContent).toBe("?periodo=30");
  });

  it("identifica o período dos últimos dados válidos quando a atualização falha", async () => {
    renderPage();
    await screen.findByText("Beleza GO");
    apiRequest.mockRejectedValue(new Error("Falha ao consultar aquisição."));
    fireEvent.click(screen.getByRole("button", { name: "30 dias" }));
    expect((await screen.findByRole("alert")).textContent).toContain("últimos dados válidos");
    expect(screen.getByText("Beleza GO")).not.toBeNull();
    expect(screen.getByLabelText("Recorte temporal").textContent).toContain("7 dias");
  });
});
