// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicShell } from "./PublicShell";

const sessionState = vi.hoisted(() => ({
  authenticated: false,
  ehAdministrador: false,
  temNegocio: false
}));

vi.mock("../auth/SessionContext", () => ({
  useSession: () => sessionState
}));

afterEach(() => {
  cleanup();
  sessionState.authenticated = false;
  sessionState.ehAdministrador = false;
  sessionState.temNegocio = false;
  document.documentElement.classList.remove("public-context-active");
});

function renderShell(pathname = "/") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <PublicShell>
        <main>Conteúdo atual</main>
      </PublicShell>
    </MemoryRouter>
  );
}

describe("PublicShell", () => {
  it("marca descoberta e cliente como contexto público", () => {
    const { container } = renderShell("/");

    expect(container.querySelector('[data-frontend-context="public"]')).not.toBeNull();
    expect(document.documentElement.classList.contains("public-context-active")).toBe(true);
    expect(screen.getByText("Conteúdo atual")).not.toBeNull();
  });

  it.each(["/admin", "/painel", "/profissional/agenda"])(
    "não envolve o contexto operacional %s",
    (pathname) => {
      const { container } = renderShell(pathname);

      expect(container.querySelector('[data-frontend-context="public"]')).toBeNull();
      expect(document.documentElement.classList.contains("public-context-active")).toBe(false);
    }
  );

  it("mantém conta de cliente no contexto público", () => {
    const { container } = renderShell("/conta");

    expect(container.querySelector('[data-frontend-context="public"]')).not.toBeNull();
  });

  it("mantém /cliente/conta no contexto cliente mesmo para identidade multi-papel", () => {
    sessionState.authenticated = true;
    sessionState.temNegocio = true;

    const { container } = renderShell("/cliente/conta");

    expect(container.querySelector('[data-frontend-context="public"]')).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Área da cliente" })).not.toBeNull();
  });

  it("remove a navegação pessoal durante a confirmação focada", () => {
    sessionState.authenticated = true;
    renderShell("/confirmar");

    expect(screen.queryByRole("navigation", { name: "Área da cliente" })).toBeNull();
  });

  it("delega conta ligada a negócio ao workspace privado", () => {
    sessionState.temNegocio = true;
    const { container } = renderShell("/conta");

    expect(container.querySelector('[data-frontend-context="public"]')).toBeNull();
  });

  it("delega conta administrativa ao AdminShell", () => {
    sessionState.ehAdministrador = true;
    const { container } = renderShell("/conta");

    expect(container.querySelector('[data-frontend-context="public"]')).toBeNull();
  });
});
