// @vitest-environment jsdom

import { Suspense } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceLayout } from "./WorkspaceLayout";

vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({
    negocio: {
      id: 11,
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

describe("WorkspaceLayout no contexto da dona", () => {
  it("resolve o contexto para o OwnerShell sem alterar o conteúdo da rota", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/painel"]}>
        <Suspense fallback={<p>Carregando contexto...</p>}>
          <WorkspaceLayout>
            <p>Conteúdo do painel</p>
          </WorkspaceLayout>
        </Suspense>
      </MemoryRouter>
    );

    await screen.findByText("Conteúdo do painel");

    expect(
      container.querySelector('[data-frontend-context="owner"]')
    ).not.toBeNull();
    expect(
      container.querySelector('.workspace-shell--professional')
    ).toBeNull();
  });
});
