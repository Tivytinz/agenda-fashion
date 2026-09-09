// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminLayout } from "./AdminLayout";
import { WorkspaceLayout } from "./WorkspaceLayout";

vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({
    negocio: {
      nome: "Studio Aurora",
      papel: "dono"
    }
  })
}));

afterEach(cleanup);

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

  it("mantém a área profissional no contexto visual do Agenda Fashion", () => {
    render(
      <MemoryRouter>
        <WorkspaceLayout>
          <h1>Área profissional</h1>
        </WorkspaceLayout>
      </MemoryRouter>
    );

    const shell = screen
      .getByRole("complementary", { name: "Área de trabalho" })
      .closest(".workspace-shell");

    expect(shell?.classList.contains("workspace-shell--professional")).toBe(true);
    expect(shell?.classList.contains("workspace-shell--admin")).toBe(false);
    expect(screen.getByText("Studio Aurora")).not.toBeNull();
  });
});
