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
          reconciliacao_campanhas_completa: true,
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

    const healthyBadge = await screen.findByText("Saudável");
    const partialBadge = screen.getByText("Parcial");
    expect(healthyBadge.classList.contains("is-success")).toBe(true);
    expect(partialBadge.classList.contains("is-warning")).toBe(true);
    expect(screen.getByText("Custos automáticos ativos")).not.toBeNull();
    expect(
      screen.getByText("Atualização a cada 6h · alerta após 12h sem sincronização.")
    ).not.toBeNull();
    expect(
      screen.queryByText(
        "18 registro(s) importado(s) na última sincronização."
      )
    ).toBeNull();
    expect(
      screen.getByText(
        "2 campanha(s) externa(s) ficaram sem vínculo na última sincronização."
      )
    ).not.toBeNull();
    expect(screen.getByText("18 registros importados")).not.toBeNull();
    expect(
      screen.getByText("7 registros importados · 2 campanhas externas sem vínculo")
    ).not.toBeNull();
  });

  it("destaca falha da integração como estado crítico", async () => {
    const payload = integrationsPayload();
    payload.provedores[0].saude = {
      codigo: "erro",
      rotulo: "Erro",
      nivel: "erro",
      detalhe: "A última sincronização falhou."
    };

    apiRequest.mockImplementation((path) => {
      if (path === "/admin/marketing/custos-integracoes") {
        return Promise.resolve(payload);
      }
      if (path === "/admin/marketing/gestao-campanhas") {
        return Promise.resolve({ campanhas: [] });
      }
      if (path.endsWith("/campanhas")) {
        return Promise.resolve({ contaExternaId: "6770207927", campanhas: [] });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    render(<MarketingCostIntegrationsPanel />);

    const errorBadge = await screen.findByText("Erro");
    expect(errorBadge.classList.contains("is-critical")).toBe(true);
    expect(screen.getByText("A última sincronização falhou.")).not.toBeNull();
  });

  it("solicita nova reconciliação quando a execução antiga não auditou todas as campanhas", async () => {
    const payload = integrationsPayload();
    payload.provedores[0].ultimaSincronizacao = {
      ...payload.provedores[0].ultimaSincronizacao,
      reconciliacao_campanhas_completa: false
    };
    payload.provedores[0].saude = {
      codigo: "reconciliacao_pendente",
      rotulo: "Reconciliar",
      nivel: "aviso",
      detalhe:
        "Execute uma nova sincronização para comprovar todas as campanhas externas operacionais, inclusive as sem gasto."
    };

    apiRequest.mockImplementation((path) => {
      if (path === "/admin/marketing/custos-integracoes") {
        return Promise.resolve(payload);
      }
      if (path === "/admin/marketing/gestao-campanhas") {
        return Promise.resolve({ campanhas: [] });
      }
      if (path.endsWith("/campanhas")) {
        return Promise.resolve({ contaExternaId: "6770207927", campanhas: [] });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    render(<MarketingCostIntegrationsPanel />);

    const badge = await screen.findByText("Reconciliar");
    expect(badge.classList.contains("is-warning")).toBe(true);
    expect(
      screen.getByText(
        "Execute uma nova sincronização para comprovar todas as campanhas externas operacionais, inclusive as sem gasto."
      )
    ).not.toBeNull();
  });

  it("explica por que o vínculo ainda não pode ser salvo", async () => {
    render(<MarketingCostIntegrationsPanel />);

    expect(
      await screen.findByText(
        /Crie ou classifique uma campanha ativa do AF para Google Ads antes de continuar/i
      )
    ).not.toBeNull();
  });

  it("destaca quando a sincronização automática está desligada", async () => {
    const payload = integrationsPayload();
    payload.sincronizacaoAutomatica = {
      ...payload.sincronizacaoAutomatica,
      habilitado: false,
      limiteDesatualizadoHoras: 24
    };

    apiRequest.mockImplementation((path) => {
      if (path === "/admin/marketing/custos-integracoes") {
        return Promise.resolve(payload);
      }
      if (path === "/admin/marketing/gestao-campanhas") {
        return Promise.resolve({ campanhas: [] });
      }
      if (path.endsWith("/campanhas")) {
        return Promise.resolve({ contaExternaId: "6770207927", campanhas: [] });
      }
      return Promise.reject(new Error(`Rota inesperada: ${path}`));
    });

    render(<MarketingCostIntegrationsPanel />);

    expect(
      await screen.findByText("Custos automáticos desativados")
    ).not.toBeNull();
    expect(
      screen.getByText("Sincronização manual disponível · alerta após 24h sem atualização.")
    ).not.toBeNull();
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
