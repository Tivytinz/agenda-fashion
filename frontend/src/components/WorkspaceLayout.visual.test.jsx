// @vitest-environment jsdom

import { Suspense } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminLayout } from "./AdminLayout";
import { WorkspaceLayout } from "./WorkspaceLayout";

const sessionState = vi.hoisted(() => ({
  negocio: {
    nome: "Studio Aurora",
    papel: "dono",
    slug: "studio-aurora"
  }
}));

vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({ negocio: sessionState.negocio })
}));

afterEach(() => {
  cleanup();
  sessionState.negocio = {
    nome: "Studio Aurora",
    papel: "dono",
    slug: "studio-aurora"
  };
  document.documentElement.classList.remove("owner-context-active");
  document.documentElement.classList.remove("professional-context-active");
});

describe("contextos visuais do workspace", () => {
  it("renderiza o administrativo em shell próprio sem reutilizar o workspace profissional", () => {
    render(
      <MemoryRouter>
        <AdminLayout>
          <h1>Visão administrativa</h1>
        </AdminLayout>
      </MemoryRouter>
    );

    const sidebar = screen.getByRole("complementary", {
      name: "Administração do Agenda Fashion"
    });
    const sidebarQueries = within(sidebar);
    const adminShell = sidebar.closest(".admin-shell");

    expect(adminShell).not.toBeNull();
    expect(adminShell?.getAttribute("data-frontend-context")).toBe("admin");
    expect(adminShell?.classList.contains("workspace-shell")).toBe(false);
    expect(sidebar.classList.contains("admin-sidebar")).toBe(true);
    expect(sidebar.classList.contains("workspace-sidebar")).toBe(false);
    expect(document.querySelector(".workspace-shell--admin")).toBeNull();
    expect(sidebarQueries.getByText("Command Center")).not.toBeNull();
    expect(sidebarQueries.getByText("Visão geral")).not.toBeNull();
    expect(sidebarQueries.getByText("Aquisição")).not.toBeNull();
    expect(sidebarQueries.getByText("Operação")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Visão administrativa" })).not.toBeNull();
  });

  it("renderiza a dona no OwnerShell próprio", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/painel"]}>
        <Suspense fallback={<p>Carregando contexto...</p>}>
          <WorkspaceLayout>
            <h1>Gestão da dona</h1>
          </WorkspaceLayout>
        </Suspense>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Gestão da dona" });

    const ownerShell = container.querySelector('[data-frontend-context="owner"]');
    expect(ownerShell).not.toBeNull();
    expect(ownerShell?.classList.contains("owner-shell")).toBe(true);
    expect(ownerShell?.classList.contains("professional-shell")).toBe(false);
    expect(screen.getByRole("complementary", { name: "Gestão do negócio" })).not.toBeNull();
    expect(screen.getAllByText("Studio Aurora").length).toBeGreaterThan(0);
  });

  it("renderiza a profissional no ProfessionalShell próprio", async () => {
    sessionState.negocio = {
      nome: "Studio Aurora",
      papel: "profissional",
      slug: "studio-aurora"
    };

    const { container } = render(
      <MemoryRouter initialEntries={["/profissional/agenda"]}>
        <Suspense fallback={<p>Carregando contexto...</p>}>
          <WorkspaceLayout>
            <h1>Agenda da profissional</h1>
          </WorkspaceLayout>
        </Suspense>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Agenda da profissional" });

    const professionalShell = container.querySelector(
      '[data-frontend-context="professional"]'
    );
    const sidebar = screen.getByRole("complementary", { name: "Área profissional" });

    expect(professionalShell).not.toBeNull();
    expect(professionalShell?.classList.contains("professional-shell")).toBe(true);
    expect(professionalShell?.classList.contains("workspace-shell")).toBe(false);
    expect(sidebar).not.toBeNull();
    expect(
      within(sidebar).getByRole("navigation", { name: "Rotina profissional" })
    ).not.toBeNull();
    expect(screen.getAllByText("Studio Aurora").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Minha agenda/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Equipe/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Plano e assinatura/ })).toBeNull();
  });
});
