// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OwnerShell } from "./OwnerShell";

vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({
    negocio: {
      id: 11,
      nome: "Studio Aurora",
      papel: "dono",
      slug: "studio-aurora"
    }
  })
}));

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("owner-context-active");
});

describe("OwnerShell", () => {
  it("separa a gestão do negócio do workspace profissional", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/painel"]}>
        <OwnerShell>
          <h1>Visão da dona</h1>
        </OwnerShell>
      </MemoryRouter>
    );

    expect(
      container.querySelector('[data-frontend-context="owner"]')
    ).not.toBeNull();
    expect(
      screen.getByRole("complementary", { name: "Gestão do negócio" })
    ).not.toBeNull();
    expect(screen.getAllByText("Studio Aurora").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "Ver perfil" }).getAttribute("href")
    ).toBe("/negocio/studio-aurora");
    expect(
      screen.getByRole("heading", { name: "Visão da dona" })
    ).not.toBeNull();
    expect(document.documentElement.classList.contains("owner-context-active")).toBe(true);
  });

  it("mantém as rotas de gestão e conta na navegação da dona", () => {
    render(
      <MemoryRouter initialEntries={["/painel/agenda"]}>
        <OwnerShell />
      </MemoryRouter>
    );

    const navigation = screen.getAllByRole("navigation", {
      name: "Área de trabalho"
    })[0];

    expect(navigation).not.toBeNull();
    expect(screen.getAllByRole("link", { name: /Agenda/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Serviços/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Equipe/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Plano e assinatura/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Minha conta/ }).length).toBeGreaterThan(0);
  });
});
