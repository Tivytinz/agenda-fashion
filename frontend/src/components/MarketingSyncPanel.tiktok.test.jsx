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
import { MarketingSyncPanel } from "./MarketingSyncPanel";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation((path) => {
    if (path === "/admin/marketing/custos-integracoes") {
      return Promise.resolve({
        sincronizacaoAutomatica: {
          habilitado: false
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
      });
    }
    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
});

afterEach(cleanup);

describe("MarketingSyncPanel com TikTok Ads", () => {
  it("mostra TikTok e exige OAuth antes da sincronização", async () => {
    render(<MarketingSyncPanel />);

    expect(
      await screen.findByRole("heading", {
        name: "Google Ads, Meta Ads e TikTok Ads"
      })
    ).not.toBeNull();
    expect(screen.getByText("TikTok Ads")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Autorizar TikTok" })
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Sincronizar agora" })
    ).toBeNull();
  });
});
