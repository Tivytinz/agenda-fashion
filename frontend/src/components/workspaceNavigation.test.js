import { describe, expect, it } from "vitest";
import {
  isWorkspaceRouteActive,
  splitMobileLinks
} from "./workspaceNavigation";

describe("navegação mobile da área de trabalho", () => {
  const links = [
    ["/painel", "Visão geral", "⌂"],
    ["/painel/agenda", "Agenda", "▦"],
    ["/painel/servicos", "Serviços", "✦"],
    ["/painel/profissionais", "Equipe", "♙"],
    ["/painel/horarios", "Horários", "◷"],
    ["/painel/negocio", "Meu negócio", "◇"]
  ];

  it("mantém quatro destinos visíveis e move o restante para Mais", () => {
    const result = splitMobileLinks(links);

    expect(result.primary.map((link) => link[1])).toEqual([
      "Visão geral",
      "Agenda",
      "Serviços",
      "Equipe"
    ]);
    expect(result.secondary.map((link) => link[1])).toEqual([
      "Horários",
      "Meu negócio"
    ]);
  });

  it("não cria menu Mais quando todos os destinos cabem", () => {
    const result = splitMobileLinks(links.slice(0, 3));

    expect(result.primary).toHaveLength(3);
    expect(result.secondary).toEqual([]);
  });

  it("reconhece rotas filhas sem ativar Visão geral indevidamente", () => {
    expect(
      isWorkspaceRouteActive(
        "/painel/servicos/42/editar",
        "/painel/servicos"
      )
    ).toBe(true);
    expect(
      isWorkspaceRouteActive("/painel/agenda", "/painel")
    ).toBe(false);
  });
});
