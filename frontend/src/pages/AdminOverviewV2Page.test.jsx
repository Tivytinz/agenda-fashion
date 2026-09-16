// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { AdminOverviewV2Page } from "./AdminAnalyticsV2Pages";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

const OVERVIEW = {
  periodo: "30",
  audiencia: {
    usuariosAtivos: 42,
    sessoes: 70,
    visualizacoes: 120,
    tempoMedioSessaoSegundos: 90
  },
  aquisicao: {
    cadastrosProfissionais: 10
  },
  ativacao: {
    negociosCriados: 8,
    servicosCriados: 7,
    negociosPublicados: 6,
    primeirosAgendamentos: 4,
    taxaNegocioSobreCadastro: 80,
    taxaServicoSobreCadastro: 70,
    taxaPublicacaoSobreCadastro: 60,
    taxaPrimeiroAgendamentoSobreCadastro: 40
  },
  demanda: {
    agendamentosValidos: 9
  },
  receita: {
    assinaturasAtivadasCohorte: 2,
    taxaAssinaturaSobreCadastro: 20,
    receitaConfirmada: 199.8,
    pagamentosConfirmados: 3,
    negociosComPagamento: 2
  },
  metodologia: {
    audiencia: "Audiência first-party do período.",
    ativacao: "Ativação acompanha a coorte profissional.",
    receita: "Receita considera pagamentos confirmados."
  }
};

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/admin?periodo=30"]}>
      <AdminOverviewV2Page />
      <LocationProbe />
    </MemoryRouter>
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue(OVERVIEW);
});

afterEach(cleanup);

describe("visão geral administrativa v2", () => {
  it("usa o contrato v2 e separa ativação da coorte dos fatos financeiros", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Visão geral" })
    ).not.toBeNull();

    expect(apiRequest).toHaveBeenCalledWith(
      "/admin/analytics-v2/overview?periodo=30",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    expect(screen.getByText("Usuários ativos")).not.toBeNull();
    expect(screen.getAllByText("Cadastros profissionais").length).toBeGreaterThan(0);
    expect(screen.getByText("Coorte profissional: do cadastro à assinatura")).not.toBeNull();
    expect(screen.getByText("1º agendamento válido")).not.toBeNull();
    expect(screen.getByText("Cadastro → 1º agendamento").closest("div")?.textContent).toContain("40%");
    expect(screen.getByText("Cadastro → assinatura paga").closest("div")?.textContent).toContain("20%");
    expect(screen.getByText(/R\$\s*199,80/)).not.toBeNull();
    expect(screen.getByText("Pagamentos confirmados").closest("div")?.textContent).toContain("3");
    expect(screen.queryByText("Agendas configuradas")).toBeNull();
    expect(screen.queryByText(/agenda confirmada/i)).toBeNull();
  });

  it("persiste o período na URL e consulta novamente a visão geral", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Visão geral" });

    apiRequest.mockResolvedValue({ ...OVERVIEW, periodo: "7" });
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenLastCalledWith(
        "/admin/analytics-v2/overview?periodo=7",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
    expect(screen.getByTestId("location").textContent).toBe("?periodo=7");
    expect(screen.getByLabelText("Recorte temporal").textContent).toContain("7 dias");
  });

  it("mantém os últimos dados válidos identificados quando a atualização falha", async () => {
    renderPage();
    await screen.findByText("42");

    apiRequest.mockRejectedValue(new Error("Falha ao consultar visão geral."));
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));

    expect((await screen.findByRole("alert")).textContent).toContain("últimos dados válidos");
    expect(screen.getByText("42")).not.toBeNull();
    expect(screen.getByLabelText("Recorte temporal").textContent).toContain("30 dias");
  });
});
