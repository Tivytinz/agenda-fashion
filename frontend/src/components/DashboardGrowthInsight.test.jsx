// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardGrowthInsight } from "./DashboardGrowthInsight";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  track: vi.fn(),
}));

vi.mock("../api/client", () => ({
  apiRequest: mocks.apiRequest,
}));

vi.mock("../analytics/track", () => ({
  track: mocks.track,
}));

vi.mock("./PublicShareButton", () => ({
  PublicShareButton: ({ label, shareText }) => (
    <button data-share-text={shareText || ""} type="button">
      {label}
    </button>
  ),
}));

beforeEach(() => {
  mocks.apiRequest.mockReset();
  mocks.track.mockReset();
});

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
    expect(screen.queryByRole("button", {
      name: "✨ Criar texto de divulgação",
    })).toBeNull();
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

  it("gera texto somente para oportunidade de compartilhamento e preserva o período", async () => {
    mocks.apiRequest.mockResolvedValue({
      fonte: "openai",
      titulo: "Alongamento em destaque",
      texto: "Seu alongamento está em destaque. Veja o perfil e escolha seu horário.",
    });

    render(
      <MemoryRouter>
        <DashboardGrowthInsight
          businessId={11}
          businessName="Studio Rosa"
          businessSlug="studio-rosa"
          insight={{
            status: "OPORTUNIDADE_PRIORIZADA",
            periodo: "30dias",
            oportunidade_principal: {
              codigo: "SERVICO_COM_TRACAO_CONCENTRADA",
              categoria: "demanda",
              titulo: "Aproveite seu serviço de maior tração",
              mensagem: "Alongamento concentrou os agendamentos do período.",
              evidencias: [],
              acao: {
                tipo: "COMPARTILHAR_PERFIL",
                rotulo: "Compartilhar perfil",
              },
            },
          }}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", {
      name: "✨ Criar texto de divulgação",
    }));

    await waitFor(() => {
      expect(mocks.apiRequest).toHaveBeenCalledWith(
        "/dashboard-dono/copilot/divulgacao",
        expect.objectContaining({
          method: "POST",
          body: {
            periodo: "30dias",
            canal: "whatsapp",
          },
        })
      );
    });

    const textarea = await screen.findByLabelText("Texto de divulgação");
    expect(textarea.value).toContain("alongamento está em destaque");

    const shareButton = screen.getByRole("button", {
      name: "Compartilhar texto + perfil",
    });
    expect(shareButton.getAttribute("data-share-text")).toContain(
      "alongamento está em destaque"
    );

    expect(mocks.track).toHaveBeenCalledWith(
      "copilot_divulgacao_gerada",
      expect.objectContaining({
        properties: expect.objectContaining({
          fonte_copilot: "openai",
          canal_copilot: "whatsapp",
        }),
      })
    );
  });
});
