// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen
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
    if (path === "/admin/negocios") {
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
        }]
      });
    }

    if (path === "/admin/agendamentos") {
      return Promise.resolve({
        agendamentos: [{
          id: 7,
          data: "2026-09-04",
          horario: "18:00",
          status: "confirmado",
          cliente_nome: "Maria",
          cliente_whatsapp: "62999999999",
          negocio: "Studio Aurora",
          servico: "Manicure",
          profissional: "Ana"
        }]
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
  it("separa negócios, agendamentos e marketplace sem expor WhatsApp de cliente", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminOperationPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Operação da plataforma" })
    ).not.toBeNull();
    expect(screen.getByText("Studio Aurora")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Agendamentos" }));
    expect(screen.getByText("Maria")).not.toBeNull();
    expect(screen.getByText("Manicure")).not.toBeNull();
    expect(screen.queryByText("62999999999")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Marketplace" }));
    expect(screen.getByRole("heading", { name: "Negócios mais agendados" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Negócios mais vistos" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Cidades com atividade" })).not.toBeNull();
  });
});
