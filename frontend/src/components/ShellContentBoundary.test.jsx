
// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ShellContentBoundary } from "./ShellContentBoundary";

function BrokenPage() {
  throw new Error("falha de teste");
}

describe("ShellContentBoundary", () => {
  it("isola falhas do conteúdo e mantém um fallback acessível", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/painel"]}>
        <ShellContentBoundary>
          <BrokenPage />
        </ShellContentBoundary>
      </MemoryRouter>
    );

    expect(screen.getByRole("alert")).not.toBeNull();
    expect(screen.getByText("Não conseguimos abrir este conteúdo")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Atualizar página" })).not.toBeNull();

    consoleError.mockRestore();
  });

  it("reinicia o boundary quando a rota muda", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/painel"]}>
        <Routes>
          <Route
            path="/painel"
            element={(
              <ShellContentBoundary>
                <BrokenPage />
              </ShellContentBoundary>
            )}
          />
          <Route
            path="/painel/agenda"
            element={(
              <ShellContentBoundary>
                <p>Agenda recuperada</p>
              </ShellContentBoundary>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("alert")).not.toBeNull();
    consoleError.mockRestore();
  });
});
