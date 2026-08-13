// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { apiRequest } from "../api/client";
import { MarketingCostIntegrationsPanel } from "./MarketingCostIntegrationsPanel";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function integrationsPayload() {
  return {
    sincronizacaoAutomatica: {
      habilitado: true,
      intervaloHoras: 6,
      primeiraExecucaoSegundos: 60,
      limiteDesatualizadoHoras: 12
    },
    provedores: [
      {
        provedor: "google_ads",
        nome: "Google Ads",
        habilitado: true,
        configurado: true,
        contaExternaId: "6770207927",
        vinculos: 2,
        ultimaSincronizacao: {
          status: "sucesso",
          registros_importados: 18,
          campanhas_nao_vinculadas: 0,
          finished_at: "2026-08-12T20:00:00Z"
        },
        saude: {
          codigo: "saudavel",
          rotulo: "Saudável",
          nivel: "sucesso",
          detalhe: "18 registro(s) importado(s) na última sincronização."
        }
      },
      {
        provedor: "meta_ads",
        nome: "Meta Ads",
        habilitado: true,
        configurado: true,
        contaExternaId: "1122334455",
        vinculos: 1,
        ultimaSincronizacao: {
          status: "parcial",
          registros_importados: 7,
          campanhas_nao_vinculadas: 2,
          finished_at: "2026-08-12T20:00:00Z"
        },
        saude: {
          codigo: "parcial",
          rotulo: "Parcial",
          nivel: "aviso",
          detalhe: "2 campanha(s) externa(s) ficaram sem vínculo na última sincronização."
        }
      }
    ],
    vinculos: []
  };
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation((path) => {
    if (path === "/admin/marketing/custos-integracoes") {
      return Promise.resolve(integrationsPayload());
    }
    if (path === "/admin/marketing/gestao-campanhas") {
      return Promise.resolve({ campanhas: [] });
    }
    if (path.endsWith("/campanhas")) {
      return Promise.resolve({
        contaExternaId: path.includes("google_ads")
          ? "6770207927"
          : "1122334455",
        campanhas: []
      });
    }
    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
});

afterEach(cleanup);

describe("saúde das integrações de custo no admin", () => {
  it("mostra agenda automática, saúde e detalhes da última sincronização", async () => {
    render(<MarketingCostIntegrationsPanel />);

    expect(
      await screen.findByText("Saudável")
    ).not.toBeNull();
    expect(screen.getByText("Parcial")).not.toBeNull();
    expect(
      screen.getByText(
        /Sincronização automática ativa a cada 6h.*desatualização após 12h/i
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        "18 registro(s) importado(s) na última sincronização."
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        "2 campanha(s) externa(s) ficaram sem vínculo na última sincronização."
      )
    ).not.toBeNull();
    expect(screen.getByText("18 importado(s) · 0 sem vínculo")).not.toBeNull();
    expect(screen.getByText("7 importado(s) · 2 sem vínculo")).not.toBeNull();
  });

  it("preserva integrações visíveis quando a lista de campanhas do AF falha", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/admin/marketing/custos-integracoes") {
        return Promise.resolve(integrationsPayload());
      }
      if (path === "/admin/marketing/gestao-campanhas") {
        return Promise.reject(new Error("Campanhas indisponíveis"));
      }
      if (path.endsWith("/campanhas")) {
        return Promise.resolve({
          contaExternaId: "6770207927",
          campanhas: []
        });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    render(<MarketingCostIntegrationsPanel />);

    expect(await screen.findByText("Saudável")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(
      /Parte do painel.*Campanhas indisponíveis/i
    );
  });
});
