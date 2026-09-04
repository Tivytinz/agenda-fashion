// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardGrowthInsight } from "./DashboardGrowthInsight";

vi.mock("../analytics/track", () => ({
  track: vi.fn(),
}));

vi.mock("./PublicShareButton", () => ({
  PublicShareButton: ({ label }) => (
    <button type="button">{label}</button>
  ),
}));

afterEach(cleanup);

describe("DashboardGrowthInsight", () => {
  it("não aparece antes de existir oportunidade priorizada", () => {
    const { container } = render(
      <MemoryRouter>
        <DashboardGrowthInsight
          insight={{
            status: "DADOS_INSUFICIENTES",
            oportunidade_principal: null,
          }}
          businessId={11}
        />
      </MemoryRouter>
    );

    expect(container.innerHTML).toBe("");
  });

  it("mostra evidências e mantém navegação em destino permitido", () => {
    render(
      <MemoryRouter>
        <DashboardGrowthInsight
          businessId={11}
          insight={{
            status: "OPORTUNIDADE_PRIORIZADA",
            oportunidade_principal: {
              codigo: "CONVERSAO_SEM_AGENDAMENTO",
              categoria: "conversao",
              titulo: "Transforme visitas em agendamentos",
              mensagem: "Há sinal suficiente para revisar a conversão.",
              evidencias: [
                {
                  chave: "visitas_perfil",
                  rotulo: "Visitas ao perfil",
                  valor: 50,
                },
                {
                  chave: "taxa_conversao",
                  rotulo: "Conversão",
                  valor: 0,
                  unidade: "%",
                },
              ],
              acao: {
                tipo: "NAVEGAR",
                rotulo: "Revisar meu perfil",
                destino: "/painel/negocio",
              },
            },
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", {
      name: "Transforme visitas em agendamentos",
    })).not.toBeNull();
    expect(screen.getByLabelText("Evidências da oportunidade")).not.toBeNull();
    expect(screen.getByRole("link", {
      name: "Revisar meu perfil",
    }).getAttribute("href")).toBe("/painel/negocio");
  });

  it("não renderiza link fornecido pelo backend quando o destino não está na allowlist", () => {
    render(
      <MemoryRouter>
        <DashboardGrowthInsight
          businessId={11}
          insight={{
            status: "OPORTUNIDADE_PRIORIZADA",
            oportunidade_principal: {
              codigo: "TESTE",
              categoria: "geral",
              titulo: "Teste",
              mensagem: "Teste",
              acao: {
                tipo: "NAVEGAR",
                rotulo: "Abrir",
                destino: "https://example.com",
              },
            },
          }}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: "Abrir" })).toBeNull();
  });
});
