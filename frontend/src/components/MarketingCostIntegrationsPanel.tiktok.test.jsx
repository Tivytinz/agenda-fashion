// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
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

function payloadTikTok({ autorizado = false } = {}) {
  return {
    sincronizacaoAutomatica: {
      habilitado: false,
      intervaloHoras: 6,
      primeiraExecucaoSegundos: 60,
      limiteDesatualizadoHoras: 24
    },
    provedores: [
      {
        provedor: "google_ads",
        nome: "Google Ads",
        habilitado: false,
        configurado: false,
        contaExternaId: null,
        vinculos: 0,
        ultimaSincronizacao: null,
        saude: {
          codigo: "desativado",
          rotulo: "Desativado",
          detalhe: "Integração desligada no ambiente."
        }
      },
      {
        provedor: "meta_ads",
        nome: "Meta Ads",
        habilitado: false,
        configurado: false,
        contaExternaId: null,
        vinculos: 0,
        ultimaSincronizacao: null,
        saude: {
          codigo: "desativado",
          rotulo: "Desativado",
          detalhe: "Integração desligada no ambiente."
        }
      },
      {
        provedor: "tiktok_ads",
        nome: "TikTok Ads",
        habilitado: true,
        configurado: autorizado,
        contaExternaId: "7673281927140098056",
        vinculos: 0,
        ultimaSincronizacao: null,
        autorizacao: {
          disponivel: true,
          autorizado,
          fonte: autorizado ? "oauth" : null,
          accessTokenExpiresAt: autorizado ? "2026-08-14T03:00:00Z" : null,
          refreshTokenExpiresAt: autorizado ? "2027-08-13T03:00:00Z" : null
        },
        saude: {
          codigo: autorizado ? "nao_sincronizado" : "configuracao_incompleta",
          rotulo: autorizado ? "Não sincronizado" : "Configuração incompleta",
          detalhe: autorizado
            ? "Conta configurada, mas nenhum custo foi sincronizado ainda."
            : "Autorize a conta TikTok no painel para concluir a configuração."
        }
      }
    ],
    vinculos: []
  };
}

function instalarMock({ autorizado = false } = {}) {
  apiRequest.mockImplementation((path) => {
    if (path === "/admin/marketing/custos-integracoes") {
      return Promise.resolve(payloadTikTok({ autorizado }));
    }
    if (path === "/admin/marketing/gestao-campanhas") {
      return Promise.resolve({
        campanhas: [
          {
            id: 9,
            nome: "TikTok Profissionais",
            canal: "tiktok"
          }
        ]
      });
    }
    if (path.endsWith("/campanhas")) {
      return Promise.resolve({
        contaExternaId: "7673281927140098056",
        campanhas: autorizado
          ? [
              {
                id: "123456",
                nome: "TikTok Campanha Real",
                status: "ENABLE",
                tipo: "TRAFFIC"
              }
            ]
          : []
      });
    }
    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
}

beforeEach(() => {
  apiRequest.mockReset();
  window.history.replaceState({}, "", "/admin/trafego-pago/custos");
});

afterEach(cleanup);

describe("OAuth TikTok no painel de custos", () => {
  it("mostra ação de autorização quando ambiente está pronto e conta ainda não foi autorizada", async () => {
    instalarMock({ autorizado: false });
    render(<MarketingCostIntegrationsPanel />);

    expect(
      await screen.findByRole("button", { name: "Autorizar TikTok" })
    ).not.toBeNull();
    expect(
      screen.getByText("Autorize a conta TikTok no painel para concluir a configuração.")
    ).not.toBeNull();
  });

  it("depois do OAuth mostra conta autorizada sem expor token", async () => {
    instalarMock({ autorizado: true });
    render(<MarketingCostIntegrationsPanel />);

    expect(
      await screen.findByText("Conta TikTok autorizada via OAuth.")
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Autorizar TikTok" })).toBeNull();
    expect(document.body.textContent).not.toMatch(/access[_ -]?token/i);
    expect(document.body.textContent).not.toMatch(/refresh[_ -]?token/i);
  });

  it("consome marcador de sucesso do callback e limpa a query da barra de endereço", async () => {
    instalarMock({ autorizado: true });
    window.history.replaceState(
      {},
      "",
      "/admin/trafego-pago/custos?tiktok_oauth=success"
    );

    render(<MarketingCostIntegrationsPanel />);

    expect(
      await screen.findByText(/TikTok Ads autorizado com sucesso/i)
    ).not.toBeNull();

    await waitFor(() => {
      expect(window.location.search).toBe("");
    });
  });
});
