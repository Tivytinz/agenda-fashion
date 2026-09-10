// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicShell } from "./PublicShell";

const sessionState = vi.hoisted(() => ({
  ehAdministrador: false,
  temNegocio: false
}));

vi.mock("../auth/SessionContext", () => ({
  useSession: () => sessionState
}));

afterEach(() => {
  cleanup();
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
