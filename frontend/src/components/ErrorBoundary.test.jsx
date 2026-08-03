// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function BrokenPage() {
  throw new Error("Falha de teste");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("oferece recuperacao em vez de deixar a tela em branco", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenPage />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert").textContent)
      .toContain("Não conseguimos abrir esta página");
    expect(screen.getByRole("button", { name: "Atualizar página" }))
      .not.toBeNull();
    expect(screen.getByRole("link", { name: "Voltar ao início" }).getAttribute("href"))
      .toBe("/");
  });
});
