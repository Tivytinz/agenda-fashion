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

  it("troca Minha agenda por Explorar dentro da gestão do negócio", () => {
    renderHeader("/painel");

    const explore = screen.getByRole(
      "link",
      { name: "Explorar" }
    );

    expect(explore.getAttribute("href")).toBe("/");
    expect(
      screen.queryByRole("link", { name: "Minha agenda" })
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

  it("usa Explorar como saída clara da administração mobile", () => {
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
      screen.getByRole("link", { name: "Explorar" })
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

    expect(screen.getByRole("link", { name: "Explorar" })
      .getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Área de trabalho" })
      .getAttribute("href")).toBe("/painel");
    expect(screen.queryByRole("link", { name: "Administração" }))
      .toBeNull();
  });
});
