// @vitest-environment jsdom

import { Suspense } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminLayout } from "./AdminLayout";
import {
  NavigationShell,
  WorkspaceLayout
} from "./WorkspaceLayout";

vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({
    negocio: {
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
    expect(ownerShell?.classList.contains("workspace-shell--professional")).toBe(false);
    expect(screen.getByRole("complementary", { name: "Gestão do negócio" })).not.toBeNull();
    expect(screen.getAllByText("Studio Aurora").length).toBeGreaterThan(0);
  });

  it("mantém o contexto profissional na fundação de workspace existente", () => {
    const links = [
      ["/profissional/agenda", "Minha agenda", "calendar"],
      ["/profissional/horarios", "Meus horários", "clock"],
      ["/conta", "Minha conta", "account"]
    ];

    render(
      <MemoryRouter initialEntries={["/profissional/agenda"]}>
        <NavigationShell
          ariaLabel="Área profissional"
          identity={{
            initial: "S",
            title: "Studio Aurora",
            subtitle: "Área profissional"
          }}
          links={links}
          variant="professional"
        >
          <h1>Área profissional</h1>
        </NavigationShell>
      </MemoryRouter>
    );

    const shell = screen
      .getByRole("complementary", { name: "Área profissional" })
      .closest(".workspace-shell");

    expect(shell?.classList.contains("workspace-shell--professional")).toBe(true);
    expect(shell?.getAttribute("data-frontend-context")).toBe("professional");
    expect(screen.getByText("Studio Aurora")).not.toBeNull();
  });
});
