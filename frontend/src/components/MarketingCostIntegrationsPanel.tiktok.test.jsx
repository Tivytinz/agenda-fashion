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

function payloadTikTok() {
  return {
    sincronizacaoAutomatica: {
      habilitado: false,
      intervaloHoras: 6,
      limiteDesatualizadoHoras: 24
    },
    provedores: [{
      provedor: "tiktok_ads",
      nome: "TikTok Ads",
      habilitado: true,
      configurado: false,
      contaExternaId: "777888999",
      vinculos: 0,
      ultimaSincronizacao: null,
      requerAutorizacao: true,
      autorizacao: {
        disponivel: true,
        autorizado: false
      },
      saude: {
        codigo: "autorizacao_pendente",
        rotulo: "Autorizar",
        nivel: "aviso",
        detalhe: "Autorize a conta TikTok Ads no painel antes de testar ou sincronizar custos."
      }
    }],
    vinculos: []
  };
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation((path, options = {}) => {
    if (path === "/admin/marketing/custos-integracoes") {
      return Promise.resolve(payloadTikTok());
    }
    if (path === "/admin/marketing/gestao-campanhas") {
      return Promise.resolve({ campanhas: [] });
    }
    if (
      path === "/admin/marketing/custos-integracoes/tiktok_ads/autorizacao" &&
      options.method === "POST"
    ) {
      return Promise.resolve({
        authorizationUrl:
          "https://ads.tiktok.com/marketing_api/auth?app_id=123&state=abc&redirect_uri=https%3A%2F%2Fapp.agendafashion.com.br%2Fadmin%2Fmarketing%2Fcustos-integracoes%2Ftiktok_ads%2Fcallback"
      });
    }
    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
});

afterEach(cleanup);

describe("TikTok Ads no painel de custos", () => {
  it("mostra autorização como etapa pendente e bloqueia teste antes do OAuth", async () => {
    render(<MarketingCostIntegrationsPanel />);

    expect((await screen.findAllByText("TikTok Ads")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Autorizar").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Autorizar TikTok" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Testar conexão" }).disabled).toBe(true);
  });

});
