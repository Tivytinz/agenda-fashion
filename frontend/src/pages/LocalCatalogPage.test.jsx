import { describe, expect, it } from "vitest";

import { buildLocalCatalogApiPath } from "./LocalCatalogPage";

describe("página de catálogo local", () => {
  it("consulta a combinação canônica com paginação limitada", () => {
    expect(buildLocalCatalogApiPath({
      categoria: "cabelo",
      localidade: "goiania-go",
      page: 3
    })).toBe(
      "/catalogo-local/cabelo/goiania-go?pagina=3&limite=12"
    );
  });

  it("codifica parâmetros de rota em vez de concatenar valores crus", () => {
    const path = buildLocalCatalogApiPath({
      categoria: "cabelo/teste",
      localidade: "sao jose-sp"
    });

    expect(path).toContain("cabelo%2Fteste");
    expect(path).toContain("sao%20jose-sp");
  });
});
