// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import {
  ADMIN_LINKS,
  AdminLayout,
  MobileWorkspaceNavigation
} from "./WorkspaceLayout";

const LINKS = [
  ["/painel", "Visão geral", "⌂"],
  ["/painel/agenda", "Agenda", "▦"],
  ["/painel/servicos", "Serviços", "✦"],
  ["/painel/profissionais", "Equipe", "♙"],
  ["/painel/horarios", "Horários", "◷"],
  ["/conta", "Minha conta", "○"]
];

afterEach(cleanup);

function renderNavigation(pathname = "/painel") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <MobileWorkspaceNavigation links={LINKS} />
    </MemoryRouter>
  );
}

describe("menu mobile da área de trabalho", () => {
  it("mostra quatro atalhos e mantém as opções secundárias fechadas", () => {
    renderNavigation();

    const navigation = screen.getByRole("navigation", {
      name: "Navegação da área de trabalho"
    });

    expect(
      navigation.querySelectorAll(".workspace-mobile-link")
    ).toHaveLength(4);
    expect(screen.queryByRole("link", { name: /Horários/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Abrir mais opções/ })
        .getAttribute("aria-expanded")
    ).toBe("false");
  });

  it("abre o menu e fecha ao navegar para uma opção", async () => {
    const user = userEvent.setup();
    renderNavigation();
    const openButton = screen.getByRole("button", {
      name: /Abrir mais opções/
    });

    await user.click(openButton);

    expect(openButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: /Horários/ })).not.toBeNull();

    await user.click(screen.getByRole("link", { name: /Horários/ }));

    expect(screen.queryByRole("link", { name: /Minha conta/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Abrir mais opções/ })
        .getAttribute("aria-expanded")
    ).toBe("false");
  });

  it("fecha com Escape e devolve o foco ao botão Mais", async () => {
    const user = userEvent.setup();
    renderNavigation("/painel/horarios");
    const openButton = screen.getByRole("button", {
      name: /Abrir mais opções/
    });

    await user.click(openButton);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("link", { name: /Horários/ })).toBeNull();
    expect(document.activeElement).toBe(openButton);
    expect(
      openButton.closest(".workspace-mobile-more")?.classList.contains("active")
    ).toBe(true);
  });

  it("fecha ao clicar fora do menu", async () => {
    const user = userEvent.setup();
    renderNavigation();

    await user.click(
      screen.getByRole("button", { name: /Abrir mais opções/ })
    );
    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole("link", { name: /Horários/ })).toBeNull();
  });

  it("mantém os quatro destinos do admin visíveis e ativa apenas a rota atual", () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/admin/trafego-pago/custos"
        ]}
      >
        <MobileWorkspaceNavigation
          ariaLabel="Administração do Agenda Fashion"
          links={ADMIN_LINKS}
        />
      </MemoryRouter>
    );

    const navigation = screen.getByRole(
      "navigation",
      { name: "Administração do Agenda Fashion" }
    );
    const campaigns = screen.getByRole(
      "link",
      { name: /Campanhas/ }
    );
    const costs = screen.getByRole(
      "link",
      { name: /Custos/ }
    );

    expect(
      navigation.querySelectorAll(".workspace-mobile-link")
    ).toHaveLength(4);
    expect(campaigns.classList.contains("active")).toBe(false);
    expect(costs.classList.contains("active")).toBe(true);
    expect(screen.queryByRole("button", { name: /mais opções/i })).toBeNull();
  });

  it("renderiza a mesma navegação administrativa no conteúdo e na lateral", () => {
    render(
      <MemoryRouter>
        <AdminLayout>
          <h1>Conteúdo administrativo</h1>
        </AdminLayout>
      </MemoryRouter>
    );

    expect(
      screen.getByRole("complementary", {
        name: "Administração do Agenda Fashion"
      })
    ).not.toBeNull();
    expect(
      screen.getByRole("heading", {
        name: "Conteúdo administrativo"
      })
    ).not.toBeNull();
    expect(
      screen.getAllByRole("link", { name: /Rentabilidade/ })
    ).toHaveLength(2);
  });
});
