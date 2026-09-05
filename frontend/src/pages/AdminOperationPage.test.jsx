// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { apiRequest } from "../api/client";
import { AdminOperationPage } from "./AdminOperationPage";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation((path) => {
    if (path.startsWith("/admin/negocios?")) {
      return Promise.resolve({
        negocios: [{
          id: 1,
          nome: "Studio Aurora",
          slug: "studio-aurora",
          cidade: "Goiânia",
          bairro: "Centro",
          ativo: true,
          total_profissionais: 2,
          total_servicos: 4,
          total_agendamentos: 12
        }],
        paginacao: {
          pagina: path.includes("pagina=2") ? 2 : 1,
          limite: 25,
          total: 30,
          totalPaginas: 2
        }
      });
    }

    if (path.startsWith("/admin/agendamentos?")) {
      return Promise.resolve({
        agendamentos: [{
          id: 7,
          data: "2026-09-04",
          horario: "18:00",
          status: "cancelado",
          cliente_nome: "Maria",
          cliente_whatsapp: "62999999999",
          negocio: "Studio Aurora",
          servico: "Manicure",
          profissional: "Ana"
        }],
        paginacao: {
          pagina: 1,
          limite: 25,
          total: 1,
          totalPaginas: 1
        }
      });
    }

    if (path === "/admin/marketing") {
      return Promise.resolve({
        negociosMaisAgendados: [{
          id: 1,
          nome: "Studio Aurora",
          cidade: "Goiânia",
          total: 12
        }],
        negociosMaisVistos: [{
          id: 1,
          nome: "Studio Aurora",
          cidade: "Goiânia",
          visitas: 40
        }],
        cidades: [{ cidade: "Goiânia", total: 20 }]
      });
    }

    return Promise.reject(new Error(`Rota inesperada: ${path}`));
  });
});

afterEach(cleanup);

describe("operação administrativa", () => {
  it("pagina negócios no servidor", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminOperationPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Operação da plataforma" })
    ).not.toBeNull();
    expect(screen.getByText("30 negócios encontrados na base.")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Próxima" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining("/admin/negocios?pagina=2&limite=25"),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  it("busca agendamentos no backend, diferencia status e não expõe WhatsApp do cliente", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminOperationPage />
      </MemoryRouter>
    );

    await screen.findByText("Studio Aurora");
    await user.click(screen.getByRole("button", { name: "Agendamentos" }));
    expect(await screen.findByText("Maria")).not.toBeNull();
    expect(screen.getByText("Manicure")).not.toBeNull();
    expect(screen.queryByText("62999999999")).toBeNull();

    const status = screen.getByText("Cancelado");
    expect(status.className).toContain("is-danger");

    await user.type(screen.getByRole("searchbox"), "Maria");
    await user.selectOptions(screen.getByLabelText("Status do agendamento"), "cancelado");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringMatching(/\/admin\/agendamentos\?.*busca=Maria.*status=cancelado|\/admin\/agendamentos\?.*status=cancelado.*busca=Maria/),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  it("mantém marketplace em uma aba separada", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminOperationPage />
      </MemoryRouter>
    );

    await screen.findByText("Studio Aurora");
    await user.click(screen.getByRole("button", { name: "Marketplace" }));
    expect(await screen.findByRole("heading", { name: "Negócios mais agendados" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Negócios mais vistos" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Cidades com atividade" })).not.toBeNull();
  });
});
