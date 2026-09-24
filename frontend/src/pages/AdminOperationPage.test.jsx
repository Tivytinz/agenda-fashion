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
    if (path.startsWith("/admin/usuarios?")) {
      return Promise.resolve({
        usuarios: [{
          id: 4,
          nome: "Ana Souza",
          email: "ana@example.com",
          ativo: false,
          estado_operacional: "desativado",
          papel_admin: null,
          papeis_negocio: ["profissional"],
          total_negocios_ativos: 1,
          perfil_profissional_ativado_em:
            "2026-09-01T10:00:00.000Z",
          email_verificado_em:
            "2026-09-01T10:00:00.000Z",
          ultimo_login_em:
            "2026-09-20T10:00:00.000Z"
        }],
        paginacao: {
          pagina: 1,
          limite: 25,
          total: 1,
          totalPaginas: 1
        }
      });
    }

    if (path.startsWith("/admin/negocios?")) {
      return Promise.resolve({
        negocios: [{
          id: 1,
          nome: "Studio Aurora",
          slug: "studio-aurora",
          cidade: "Goiânia",
          bairro: "Centro",
          ativo: true,
          publicado: false,
          estado_operacional: "despublicado",
          despublicado_manual_em:
            "2026-09-20T10:00:00.000Z",
          plano_nome: "Autônoma",
          dono_nome: "Ana Souza",
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
          status: "falta",
          cliente_nome: "Maria",
          cliente_whatsapp: "62999999999",
          negocio: "Studio Aurora",
          servico: "Manicure",
          profissional: "Ana",
          duracao_minutos: 60,
          status_atendimento_em:
            "2026-09-04T21:15:00.000Z",
          status_atendimento_por_nome: "Ana"
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
        cidades: [{
          cidade: "Goiânia",
          total: 20
        }]
      });
    }

    return Promise.reject(
      new Error(`Rota inesperada: ${path}`)
    );
  });
});

afterEach(cleanup);

describe("Admin Wave 1 - operação administrativa", () => {
  it("pagina negócios no servidor e exibe estado operacional", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminOperationPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", {
        name: "Operação da plataforma"
      })
    ).not.toBeNull();

    expect(
      screen.getByText("30 negócios encontrados na base.")
    ).not.toBeNull();

    expect(
      screen.getAllByText("Despublicado").length
    ).toBeGreaterThan(0);

    expect(
      screen.getByText("Autônoma")
    ).not.toBeNull();

    await user.click(
      screen.getByRole("button", {
        name: "Próxima"
      })
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining(
          "/admin/negocios?pagina=2&limite=25"
        ),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });
  });

  it("consulta usuários por e-mail e estado sem exibir WhatsApp", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminOperationPage />
      </MemoryRouter>
    );

    await screen.findByText("Studio Aurora");

    await user.click(
      screen.getByRole("button", {
        name: "Usuários"
      })
    );

    expect(
      await screen.findByText("Ana Souza")
    ).not.toBeNull();

    expect(
      screen.getByText("ana@example.com")
    ).not.toBeNull();

    expect(
      screen.getAllByText("Desativado").length
    ).toBeGreaterThan(0);

    expect(
      screen.queryByText("62999999999")
    ).toBeNull();

    await user.selectOptions(
      screen.getByLabelText("Estado do usuário"),
      "desativado"
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining(
          "/admin/usuarios?pagina=1&limite=25&status=desativado"
        ),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });
  });

  it("usa estados canônicos de agendamento e não expõe WhatsApp do cliente", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminOperationPage />
      </MemoryRouter>
    );

    await screen.findByText("Studio Aurora");

    await user.click(
      screen.getByRole("button", {
        name: "Agendamentos"
      })
    );

    expect(
      await screen.findByText("Maria")
    ).not.toBeNull();

    expect(
      screen.getAllByText("Não compareceu").length
    ).toBeGreaterThan(0);

    expect(
      screen.getByText("60 min")
    ).not.toBeNull();

    expect(
      screen.queryByText("62999999999")
    ).toBeNull();

    await user.type(
      screen.getByRole("searchbox"),
      "Maria"
    );

    await user.selectOptions(
      screen.getByLabelText("Status do agendamento"),
      "falta"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Buscar"
      })
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringMatching(
          /\/admin\/agendamentos\?.*busca=Maria.*status=falta|\/admin\/agendamentos\?.*status=falta.*busca=Maria/
        ),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });
  });

  it("filtra negócios por estado operacional", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminOperationPage />
      </MemoryRouter>
    );

    await screen.findByText("Studio Aurora");

    await user.selectOptions(
      screen.getByLabelText("Estado do negócio"),
      "despublicado"
    );

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining(
          "status=despublicado"
        ),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
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

    await user.click(
      screen.getByRole("button", {
        name: "Marketplace"
      })
    );

    expect(
      await screen.findByRole("heading", {
        name: "Negócios mais agendados"
      })
    ).not.toBeNull();

    expect(
      screen.getByRole("heading", {
        name: "Negócios mais vistos"
      })
    ).not.toBeNull();

    expect(
      screen.getByRole("heading", {
        name: "Cidades com atividade"
      })
    ).not.toBeNull();
  });
});
