// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { DashboardPage } from "./DashboardPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("../analytics/track", () => ({
  track: vi.fn(),
}));

beforeEach(() => {
  apiRequest.mockReset();
});

afterEach(cleanup);

describe("dashboard pós-ativação", () => {
  it("prioriza growth, mostra recorrência e não repete o marco de ativação", async () => {
    const dashboard = {
      negocio: {
        negocio_id: 11,
        nome: "Studio Aurora",
        slug: "studio-aurora",
      },
      resumo: {
        agendamentos_periodo: 8,
        faturamento_periodo: 800,
        clientes_novos: 3,
        clientes_unicos: 8,
        clientes_recorrentes: 1,
        taxa_recorrencia: 12.5,
      },
      performance: {
        taxa_conversao: 8,
        visitas_perfil: 100,
        agendamentos_concluidos: 8,
        cliques_whatsapp: 4,
        cliques_maps: 2,
        favoritos_recebidos: 1,
      },
      ativacao: {
        possui_servico_ativo: true,
        negocio_publicado: true,
        agenda_configurada: true,
        primeiro_agendamento_recebido: true,
      },
      proxima_acao_ativacao: {
        estado: "ATIVADO",
        concluido: true,
        titulo: "Ativação concluída",
        mensagem:
          "Seu negócio já recebeu o primeiro agendamento pelo Agenda Fashion.",
        acao: {
          tipo: "NAVEGAR",
          rotulo: "Abrir agenda",
          destino: "/painel/agenda",
        },
      },
      inteligencia_crescimento: {
        status: "OPORTUNIDADE_PRIORIZADA",
        periodo: "7dias",
        oportunidade_principal: {
          codigo: "RECORRENCIA_BAIXA_COM_AMOSTRA",
          categoria: "retencao",
          titulo: "Fortaleça o retorno das clientes",
          mensagem:
            "Há espaço para acompanhar a recorrência sem assumir uma causa específica.",
          evidencias: [
            {
              chave: "clientes_recorrentes",
              rotulo: "Clientes que voltaram",
              valor: 1,
              unidade: null,
            },
          ],
          acao: {
            tipo: "NAVEGAR",
            rotulo: "Abrir agenda",
            destino: "/painel/agenda",
          },
        },
      },
      ranking_servicos: [],
    };

    apiRequest.mockImplementation((path) => {
      if (path.startsWith("/dashboard-dono/origem-clientes")) {
        return Promise.resolve(null);
      }
      if (path.startsWith("/dashboard-dono")) {
        return Promise.resolve(dashboard);
      }
      if (path === "/conta") {
        return Promise.resolve({
          usuario: {
            aceita_lembretes_whatsapp: true,
            aceita_alertas_operacionais_whatsapp: true,
          },
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", {
        name: "Fortaleça o retorno das clientes",
      })
    ).not.toBeNull();
    expect(
      screen.queryByRole("heading", {
        name: "Ativação concluída",
      })
    ).toBeNull();
    expect(
      screen.queryByLabelText("Negócio ativado")
    ).toBeNull();
    expect(
      screen.getAllByText("Clientes que voltaram").length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("de 8 clientes com agendamento")
    ).not.toBeNull();
    expect(
      screen.getByText("Conversão do perfil")
    ).not.toBeNull();
  });
});
