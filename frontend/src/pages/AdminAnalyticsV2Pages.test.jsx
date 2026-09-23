// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { AdminAcquisitionV2Page, AdminRevenueV2Page } from "./AdminAnalyticsV2Pages";

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

function renderRevenuePage() {
  render(<MemoryRouter initialEntries={["/admin/receita?periodo=30"]}><AdminRevenueV2Page /></MemoryRouter>);
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

describe("receita administrativa v2", () => {
  it("separa receita inicial, renovação e mudança de plano", async () => {
    apiRequest.mockResolvedValue({
      periodo: "30",
      resumo: {
        receitaBruta: 249.6,
        receitaValidaAtual: 249.6,
        receitaPrimeiraConversao: 49.9,
        receitaRenovacao: 99.8,
        receitaMudancaPlano: 99.9,
        pagamentosEmReversao: 0,
        valorExpostoReversoes: 0,
        assinaturasPagasAtivas: 1,
        novosNegociosPagantes: 1,
        pagamentosRenovacao: 2,
        negociosComRenovacao: 1,
        pagamentosMudancaPlano: 1,
        pagamentosConfirmados: 4,
        negociosPagantes: 1,
        renovacoesPrevistas: 3,
        renovacoesConfirmadas: 2,
        taxaRenovacao: 66.67,
        renovacoesComAtraso: 2,
        renovacoesRecuperadas: 1,
        taxaRecuperacaoRenovacao: 50,
        cancelamentosRenovacaoAgendados: 0,
        assinaturasEncerradasAposCancelamento: 0,
        conversoesIniciaisCanonicas: 1,
        renovacoesConfirmadasCanonicas: 2,
        reativacoesPagas: 1,
        mudancasPlanoCanonicas: 1,
        pagamentosAtrasadosCanonicos: 2,
        pagamentosRecuperadosCanonicos: 1,
        reversoesFinanceirasCanonicas: 1,
        cancelamentosRenovacaoCanonicos: 1,
        saidasBasePagaCanonicas: 1,
        cancelamentosVencidosPendentesReconciliacao: 0
      },
      planos: []
    });

    renderRevenuePage();

    expect(await screen.findByText("Receita inicial")).not.toBeNull();
    expect(screen.getByText("Receita de renovação")).not.toBeNull();
    expect(screen.getByText("Mudança de plano")).not.toBeNull();
    expect(screen.getByText("Renovações vencidas no período")).not.toBeNull();
    expect(screen.getByText("Transições pagas registradas desde a Wave 22")).not.toBeNull();
    expect(screen.getByText("Reativações pagas")).not.toBeNull();
    expect(screen.getByText("Reversões financeiras")).not.toBeNull();
    expect(screen.getByText("Saídas da base paga")).not.toBeNull();
    expect(screen.getByText("Pendentes de reconciliação temporal")).not.toBeNull();
    expect(screen.getByText("66,7%")).not.toBeNull();
    expect(screen.getByText("50%")).not.toBeNull();
    expect(screen.getByText("Cancelar a próxima renovação, atrasar uma cobrança e perder o acesso pago são fatos diferentes.")).not.toBeNull();
    expect(screen.queryByText(/^Churn$/i)).toBeNull();
  });
});
