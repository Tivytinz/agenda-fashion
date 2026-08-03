import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MobileWorkspaceNavigation } from "./WorkspaceLayout";

describe("menu mobile da área de trabalho", () => {
  it("renderiza quatro atalhos e destaca Mais em uma rota secundária", () => {
    const links = [
      ["/painel", "Visão geral", "⌂"],
      ["/painel/agenda", "Agenda", "▦"],
      ["/painel/servicos", "Serviços", "✦"],
      ["/painel/profissionais", "Profissionais", "♙"],
      ["/painel/horarios", "Horários", "◷"],
      ["/conta", "Minha conta", "○"]
    ];

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/painel/horarios"]}>
        <MobileWorkspaceNavigation links={links} />
      </MemoryRouter>
    );

    expect(
      html.match(/class="workspace-mobile-link/g)
    ).toHaveLength(4);
    expect(html).toContain(
      'class="workspace-mobile-more active"'
    );
    expect(html).toContain("Horários");
    expect(html).toContain("Minha conta");
  });
});
