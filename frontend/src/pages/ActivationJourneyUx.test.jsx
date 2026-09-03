// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { BusinessPage } from "./BusinessPage";
import { DashboardPage } from "./DashboardPage";
import { ServiceEditorPage } from "./ServicesPage";

const refreshSession = vi.fn(() => Promise.resolve());

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({
    usuario: {
      id: 7,
      nome: "Ana",
      whatsapp: "62999999999"
    },
    refresh: refreshSession
  })
}));

function DestinationProbe() {
  const location = useLocation();
  return (
    <output data-testid="destination">
      {location.pathname}|{location.state?.onboardingStep || ""}
    </output>
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  refreshSession.mockClear();
});

afterEach(cleanup);

describe("jornada de ativação profissional", () => {
  it("prioriza a missão determinística de divulgação antes dos indicadores", async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith("/dashboard-dono/origem-clientes")) {
        return Promise.resolve({ resumo: {}, origens: [] });
      }
      if (path.startsWith("/dashboard-dono")) {
        return Promise.resolve({
          resumo: {
            agendamentos_periodo: 0,
            faturamento_periodo: 0,
            clientes_novos: 0
          },
          performance: {
            taxa_conversao: 0,
            visitas_perfil: 10,
            agendamentos_concluidos: 0,
            cliques_whatsapp: 0,
            cliques_maps: 0,
            favoritos_recebidos: 0
          },
          negocio: {
            negocio_id: 11,
            nome: "Studio Aurora",
            slug: "studio-aurora"
          },
          ativacao: {
            possui_servico_ativo: true,
            negocio_publicado: true,
            agenda_configurada: true,
            primeiro_agendamento_recebido: false
          },
          proxima_acao_ativacao: {
            estado: "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
            concluido: false,
            titulo: "Divulgue seu perfil",
            mensagem: "Compartilhe o link para conquistar o primeiro agendamento.",
            acao: {
              tipo: "COMPARTILHAR_PERFIL",
              rotulo: "Compartilhar perfil"
            }
          },
          ranking_servicos: []
        });
      }
      if (path === "/configuracoes") {
        return Promise.resolve({
          negocio: {
            id: 11,
            slug: "studio-aurora",
            publicado: true
          },
          publicacao: {
            publicado: true,
            pode_publicar: true,
            pendencias: []
          }
        });
      }
      if (path === "/conta") {
        return Promise.resolve({
          usuario: {
            aceita_lembretes_whatsapp: true,
            aceita_alertas_operacionais_whatsapp: true
          }
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    const missionHeading = await screen.findByRole("heading", {
      name: "Divulgue seu perfil"
    });
    const mission = missionHeading.closest("section");
    const metrics = screen.getByLabelText("Indicadores");

    expect(Boolean(
      mission.compareDocumentPosition(metrics)
      & Node.DOCUMENT_POSITION_FOLLOWING
    )).toBe(true);
    expect(apiRequest.mock.calls.some(
      ([path]) => path === "/agenda-configuracao/status"
    )).toBe(false);
    expect(screen.queryByText(/Copilot AF/i)).toBeNull();
  });

  it("continua direto para o primeiro serviço depois da criação padrão", async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === "/cep/74000000") {
        return Promise.resolve({
          endereco: "Rua das Flores",
          bairro: "Centro",
          cidade: "Goiânia",
          estado: "GO"
        });
      }
      if (path === "/criar-negocio" && options.method === "POST") {
        return Promise.resolve({
          negocio: {
            id: 99,
            nome: "Studio Aurora"
          },
          publicacao: {
            publicado: false,
            pode_publicar: false,
            pendencias: [
              "pelo menos um serviço ativo",
              "confirmar os horários de atendimento"
            ]
          }
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    render(
      <MemoryRouter initialEntries={["/criar-negocio"]}>
        <Routes>
          <Route path="/criar-negocio" element={<BusinessPage create />} />
          <Route path="*" element={<DestinationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nome do negócio/), {
      target: { value: "Studio Aurora" }
    });
    fireEvent.click(screen.getByLabelText("Unhas"));
    fireEvent.change(screen.getByLabelText(/WhatsApp/), {
      target: { value: "62999999999" }
    });
    fireEvent.change(screen.getByLabelText(/Link do Google Maps/), {
      target: { value: "https://maps.google.com/?q=Studio+Aurora" }
    });
    fireEvent.change(screen.getByLabelText(/CEP/), {
      target: { value: "74000-000" }
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Endereço").value).toBe("Rua das Flores");
      expect(screen.getByLabelText("Bairro").value).toBe("Centro");
      expect(screen.getByLabelText("Cidade").value).toBe("Goiânia");
      expect(screen.getByLabelText("Estado").value).toBe("GO");
    });

    fireEvent.change(screen.getByLabelText("Número"), {
      target: { value: "123" }
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Criar negócio" }).closest("form")
    );

    expect((await screen.findByTestId("destination")).textContent)
      .toBe("/painel/servicos/novo|servico");
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("mostra somente os dados essenciais no primeiro serviço do onboarding", () => {
    render(
      <MemoryRouter
        initialEntries={[{
          pathname: "/painel/servicos/novo",
          state: {
            onboarding: true,
            onboardingStep: "servico"
          }
        }]}
      >
        <Routes>
          <Route
            path="/painel/servicos/novo"
            element={<ServiceEditorPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(
      /informe nome, categoria, valor e duração/i
    )).not.toBeNull();
    expect(screen.getByRole("textbox", {
      name: "Nome do serviço"
    })).not.toBeNull();
    expect(screen.getByRole("combobox", {
      name: /Categoria/
    })).not.toBeNull();
    expect(screen.getByRole("spinbutton", {
      name: "Valor"
    })).not.toBeNull();
    expect(screen.getByRole("spinbutton", {
      name: "Duração em minutos"
    })).not.toBeNull();

    expect(screen.queryByRole("textbox", {
      name: /Descrição/
    })).toBeNull();
    expect(screen.queryByRole("heading", {
      name: "Fotos do serviço"
    })).toBeNull();
    expect(screen.queryByText("Serviço disponível")).toBeNull();
  });
});
