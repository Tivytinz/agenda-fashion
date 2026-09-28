
// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
});
