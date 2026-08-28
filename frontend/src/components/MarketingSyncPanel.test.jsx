// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function statusPayload() {
  return {
    sincronizacaoAutomatica: {
      habilitado: true
    },
    provedores: [
      {
        provedor: "google_ads",
        nome: "Google Ads",
        configurado: true,
        contaExternaId: "6770207927",
        ultimaSincronizacao: {
          finished_at: "2026-08-28T02:00:00.000Z"
        },
        saude: {
          codigo: "saudavel",
          nivel: "sucesso",
          rotulo: "Saudável"
        }
      },
      {
        provedor: "meta_ads",
        nome: "Meta Ads",
        configurado: false,
        saude: {
          codigo: "configuracao_incompleta",
          nivel: "aviso",
          rotulo: "Configuração incompleta"
        }
      }
    ],
    vinculos: [
      {
        campanha_id: 7,
        provedor: "google_ads",
        conta_externa_id: "6770207927",
        campanha_externa_id: "123",
        campanha_externa_nome: "Profissionais Goiás",
        campanha_nome: "Profissionais Goiás",
        objetivo: "indefinido"
      }
    ]
  };
}

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);

  apiRequest.mockImplementation((path, options = {}) => {
    if (path === "/admin/marketing/custos-integracoes") {
      return Promise.resolve(statusPayload());
    }

    if (
      path === "/admin/marketing/custos-integracoes/google_ads/campanhas"
    ) {
      return Promise.resolve({
        contaExternaId: "6770207927",
        campanhas: [
          {
            id: "123",
            nome: "Profissionais Goiás",
            status: "ENABLED"
          }
        ]
      });
    }

    if (
      path === "/admin/marketing/custos-integracoes/google_ads/sincronizar" &&
      options.method === "POST"
    ) {
      return Promise.resolve({
        campanhasImportadas: 1,
        vinculosAutomaticos: 1,
        campanhasNaoVinculadas: 0
      });
    }

    if (
      path === "/admin/marketing/gestao-campanhas/7" &&
      options.method === "PATCH"
    ) {
      return Promise.resolve({
        campanha: {
          id: 7,
          objetivo: options.body.objetivo
        }
      });
    }

    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MarketingSyncPanel", () => {
  it("sincroniza sem exigir criação prévia de campanha do AF", async () => {
    const user = userEvent.setup();

    render(<MarketingSyncPanel />);

    expect(
      await screen.findByText("Profissionais Goiás")
    ).not.toBeNull();

    expect(
      screen.queryByText("Campanha do AF")
    ).toBeNull();

    const syncButton = screen
      .getAllByRole("button", { name: "Sincronizar agora" })
      .find((button) => !button.disabled);

    expect(syncButton).toBeTruthy();
    await user.click(syncButton);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/custos-integracoes/google_ads/sincronizar",
        {
          method: "POST",
          body: {}
        }
      );
    });
  });

  it("pede apenas a classificação do objetivo quando necessário", async () => {
    const user = userEvent.setup();

    render(<MarketingSyncPanel />);

    expect(
      await screen.findByText("Objetivo pendente")
    ).not.toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Profissionais" })
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/admin/marketing/gestao-campanhas/7",
        {
          method: "PATCH",
          body: {
            objetivo: "profissional"
          }
        }
      );
    });
  });
});
