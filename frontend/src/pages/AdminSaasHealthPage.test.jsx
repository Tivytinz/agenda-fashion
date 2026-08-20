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
import { AdminSaasHealthPage } from "./AdminSaasHealthPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

const { apiRequest } = await import("../api/client");

const RESULT = {
  resumo: {
    totalProfissionais: 8,
    totalIncompletos: 6,
    semNegocio: 1,
    perfilIncompleto: 4,
    semServico: 3,
    semAgenda: 5,
    naoPublicados: 4,
    completos: 2
  },
  filtros: {
    busca: "",
    pendencia: "todos"
  },
  perfis: [
    {
      usuarioId: 42,
      nome: "Ana Souza",
      email: "ana@example.com",
      whatsapp: "11987654321",
      cadastroEm: "2026-08-01T12:00:00.000Z",
      ultimaAtividadeEm: "2026-08-02T12:00:00.000Z",
      negocio: {
        id: 19,
        nome: "Studio Ana",
        slug: "studio-ana",
        cidade: "São Paulo",
        estado: "SP",
        publicado: false
      },
      progresso: {
        etapasConcluidas: 2,
        totalEtapas: 5,
        percentual: 40
      },
      prioridade: "alta",
      pendencias: [
        {
          codigo: "agenda",
          rotulo: "Configurar agenda"
        },
        {
          codigo: "publicacao",
          rotulo: "Publicar perfil"
        }
      ]
    }
  ],
  paginacao: {
    pagina: 1,
    limite: 25,
    total: 1,
    totalPaginas: 1
  }
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  apiRequest.mockResolvedValue(RESULT);
});

describe("saúde do SaaS no admin", () => {
  it("mostra os indicadores, pendências e ações de contato", async () => {
    render(<AdminSaasHealthPage />);

    expect(
      await screen.findByRole("heading", { name: "Saúde do SaaS" })
    ).not.toBeNull();
    expect(screen.getByText("Ana Souza")).not.toBeNull();
    expect(screen.getByText("Studio Ana")).not.toBeNull();
    expect(screen.getByText("Configurar agenda")).not.toBeNull();
    expect(screen.getByText("Publicar perfil")).not.toBeNull();
    expect(screen.getByLabelText("40% do perfil concluído")).not.toBeNull();

    const whatsapp = screen.getByRole("link", { name: "WhatsApp" });
    const email = screen.getByRole("link", { name: "E-mail" });

    expect(whatsapp.getAttribute("href")).toContain("wa.me/5511987654321");
    expect(whatsapp.getAttribute("target")).toBe("_blank");
    expect(email.getAttribute("href")).toContain("mailto:ana@example.com");
  });

  it("aplica filtro de agenda e volta para a primeira página", async () => {
    const user = userEvent.setup();
    render(<AdminSaasHealthPage />);
    await screen.findByText("Ana Souza");
    apiRequest.mockClear();

    await user.click(screen.getByRole("button", { name: "Sem agenda" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining("pendencia=agenda"),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  it("busca por nome, e-mail, WhatsApp ou negócio", async () => {
    const user = userEvent.setup();
    render(<AdminSaasHealthPage />);
    await screen.findByText("Ana Souza");
    apiRequest.mockClear();

    await user.type(
      screen.getByRole("searchbox", { name: "Buscar profissional" }),
      "  Ana Souza  "
    );
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining("busca=Ana+Souza"),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });
});
