// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminLayout, WorkspaceLayout } from "./WorkspaceLayout";

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
  it("marca o administrativo como console neutro sem duplicar a identidade do admin", () => {
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
    const shell = sidebar.closest(".workspace-shell");

    expect(shell?.classList.contains("workspace-shell--admin")).toBe(true);
    expect(shell?.classList.contains("workspace-shell--professional")).toBe(false);
    expect(sidebar.classList.contains("workspace-sidebar--nav-only")).toBe(true);
    expect(screen.queryByText("AF Admin")).toBeNull();
    expect(screen.queryByText("Operação interna")).toBeNull();
    expect(screen.getByText("Visão geral")).not.toBeNull();
    expect(screen.getByText("Ativação")).not.toBeNull();
    expect(screen.getByText("Operação")).not.toBeNull();
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
