// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { useSession } from "../auth/SessionContext";
import { AppHeader } from "./AppHeader";

vi.mock("../auth/SessionContext", () => ({
  useSession: vi.fn()
}));

const logout = vi.fn();

function renderHeader(pathname) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppHeader />
    </MemoryRouter>
  );
}

beforeEach(() => {
  logout.mockReset();
  useSession.mockReturnValue({
    authenticated: true,
    ehAdministrador: false,
    temNegocio: true,
    negocio: { papel: "dono" },
    usuario: { nome: "Victor" },
    logout
  });
});

afterEach(cleanup);

describe("cabeçalho por contexto", () => {
  it("reproduz a navegação pública do protótipo", () => {
    useSession.mockReturnValue({
      authenticated: false,
      ehAdministrador: false,
      temNegocio: false,
      negocio: null,
      usuario: null,
      logout
    });

    renderHeader("/");

    expect(screen.getAllByRole("link", { name: "Início" }))
      .toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Buscar serviços" }))
      .toBeNull();
    expect(screen.getByRole("link", { name: "Favoritos" })
      .getAttribute("href")).toBe("/favoritos");
    expect(screen.getByRole("link", { name: "Meus agendamentos" })
      .getAttribute("href")).toBe("/minha-agenda");
    expect(screen.getByRole("searchbox", {
      name: "Busque por serviço ou profissional"
    })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Entrar na sua conta" })
      .getAttribute("href")).toBe("/entrar");
    expect(screen.queryByRole("link", { name: "Sou profissional" }))
      .toBeNull();
  });

  it("mostra a foto da conta no cabeçalho", () => {
    useSession.mockReturnValue({
      authenticated: true,
      ehAdministrador: false,
      temNegocio: false,
      negocio: null,
      usuario: {
        nome: "Victor",
        foto_url: "/uploads/victor.jpg"
      },
      logout
    });

    renderHeader("/");

    expect(screen.getByAltText("Foto de Victor"))
      .not.toBeNull();
    expect(screen.getByRole("button", {
      name: "Abrir conta de Victor"
    })).not.toBeNull();
  });

  it("remove saídas desnecessárias da landing profissional", () => {
    useSession.mockReturnValue({
      authenticated: false,
      ehAdministrador: false,
      temNegocio: false,
      negocio: null,
      usuario: null,
      logout
    });

    const { container } = renderHeader("/para-profissionais");

    expect(screen.queryByRole("link", { name: "Início" }))
      .toBeNull();
    expect(screen.queryByRole("link", { name: "Minha agenda" }))
      .toBeNull();
    expect(screen.queryByRole("link", { name: "Sou profissional" }))
      .toBeNull();
    expect(screen.getByRole("link", { name: "Entrar" }))
      .toBeTruthy();
    expect(screen.getByRole("link", {
      name: "Agenda Fashion, início"
    }).getAttribute("href")).toBe("/para-profissionais");
    expect(container.querySelector(".header-brand-logo"))
      .toBeTruthy();
  });

  it("usa Início como única saída pública da gestão do negócio", () => {
    renderHeader("/painel");

    const home = screen.getByRole(
      "link",
      { name: "Início" }
    );

    expect(home.getAttribute("href")).toBe("/");
    expect(
      screen.queryByRole("link", { name: "Minha agenda" })
    ).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Explorar" })
    ).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Área de trabalho" })
    ).toBeNull();
  });

  it("resume os três atalhos antigos em uma entrada Administração", () => {
    useSession.mockReturnValue({
      authenticated: true,
      ehAdministrador: true,
      temNegocio: false,
      negocio: null,
      usuario: { nome: "Admin" },
      logout
    });

    renderHeader("/");

    const administration = screen.getByRole(
      "link",
      { name: "Administração" }
    );

    expect(administration.getAttribute("href"))
      .toBe("/admin/trafego-pago");
    expect(screen.queryByText("Marketing Admin")).toBeNull();
    expect(screen.queryByText("Custos & CPA")).toBeNull();
    expect(screen.queryByText("Funil profissional")).toBeNull();
  });

  it("usa Início como saída clara da administração mobile", () => {
    useSession.mockReturnValue({
      authenticated: true,
      ehAdministrador: true,
      temNegocio: false,
      negocio: null,
      usuario: { nome: "Admin" },
      logout
    });

    renderHeader("/admin/trafego-pago");

    expect(
      screen.getByRole("link", { name: "Início" })
        .getAttribute("href")
    ).toBe("/");
    expect(
      screen.queryByRole("link", { name: "Administração" })
    ).toBeNull();
  });

  it("mantém a conta de um administrador proprietário no contexto administrativo", () => {
    useSession.mockReturnValue({
      authenticated: true,
      ehAdministrador: true,
      temNegocio: true,
      negocio: { papel: "dono" },
      usuario: { nome: "Admin" },
      logout
    });

    renderHeader("/conta");

    expect(screen.getByRole("link", { name: "Início" })
      .getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Área de trabalho" })
      .getAttribute("href")).toBe("/painel");
    expect(screen.queryByRole("link", { name: "Administração" }))
      .toBeNull();
  });
});
