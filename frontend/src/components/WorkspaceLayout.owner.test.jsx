// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
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
  it("resolve o contexto para o OwnerShell sem alterar o conteúdo da rota", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/painel"]}>
        <WorkspaceLayout>
          <p>Conteúdo do painel</p>
        </WorkspaceLayout>
      </MemoryRouter>
    );

    expect(
      container.querySelector('[data-frontend-context="owner"]')
    ).not.toBeNull();
    expect(container.textContent).toContain("Conteúdo do painel");
    expect(
      container.querySelector('.workspace-shell--professional')
    ).toBeNull();
  });
});
