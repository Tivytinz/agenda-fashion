// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AdminLayout } from "./AdminLayout";

function renderAdmin(pathname = "/admin/aquisicao") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AdminLayout>
        <h1>Conteúdo administrativo</h1>
      </AdminLayout>
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("AdminShell", () => {
  it("usa shell e classes próprias sem depender do WorkspaceLayout", () => {
    const view = renderAdmin();

    expect(document.querySelector(".admin-shell")).not.toBeNull();
    expect(document.querySelector(".workspace-shell")).toBeNull();
    expect(
      document.querySelector("[data-frontend-context='admin']")
    ).not.toBeNull();
    expect(
      document.documentElement.classList.contains("admin-context-active")
    ).toBe(true);
    expect(
      screen.getByRole("complementary", {
        name: "Administração do Agenda Fashion"
      })
    ).not.toBeNull();

    view.unmount();

    expect(
      document.documentElement.classList.contains("admin-context-active")
    ).toBe(false);
  });

  it("mantém os módulos principais no desktop e na navegação mobile", () => {
    renderAdmin("/admin/aquisicao?periodo=30d");

    expect(
      screen.getAllByRole("link", { name: /Aquisição/ })
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { name: /Jornada/ })
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { name: /Retenção/ })
    ).toHaveLength(2);

    const mobileNavigation = screen.getByRole("navigation", {
      name: "Navegação mobile da administração"
    });

    expect(
      mobileNavigation.querySelectorAll(".admin-mobile-link")
    ).toHaveLength(4);
    expect(
      screen.getByRole("link", { name: /Aquisição/ }).classList.contains("active")
    ).toBe(true);
  });

  it("abre os módulos secundários pelo botão Mais", async () => {
    const user = userEvent.setup();
    renderAdmin();

    expect(screen.queryByRole("link", { name: /Receita/ })).not.toBeNull();

    const mobileNavigation = screen.getByRole("navigation", {
      name: "Navegação mobile da administração"
    });
    expect(
      mobileNavigation.querySelector("a[href='/admin/receita']")
    ).toBeNull();

    await user.click(
      screen.getByRole("button", {
        name: "Abrir mais opções da administração"
      })
    );

    expect(
      mobileNavigation.querySelector("a[href='/admin/receita']")
    ).not.toBeNull();
    expect(
      mobileNavigation.querySelector("a[href='/admin/operacao']")
    ).not.toBeNull();
  });
});
