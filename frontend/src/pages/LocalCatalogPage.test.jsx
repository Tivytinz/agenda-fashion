import { describe, expect, it } from "vitest";

import {
  buildCanonicalCatalogLocation,
  buildLocalCatalogApiPath
} from "./LocalCatalogPage";

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

  it("troca a rota pelo caminho canônico preservando atribuição", () => {
    expect(buildCanonicalCatalogLocation({
      canonicalPath: "/servicos/cabelo/em/goiania-go",
      currentPath: "/servicos/cabelo/em/Goiânia-GO",
      search: "?utm_source=google&gclid=abc123"
    })).toBe(
      "/servicos/cabelo/em/goiania-go?utm_source=google&gclid=abc123"
    );
  });

  it("não navega quando a rota já é canônica", () => {
    expect(buildCanonicalCatalogLocation({
      canonicalPath: "/servicos/cabelo/em/goiania-go",
      currentPath: "/servicos/cabelo/em/goiania-go",
      search: "?utm_source=google"
    })).toBeNull();
  });

  it("recusa destino que não seja caminho interno", () => {
    expect(buildCanonicalCatalogLocation({
      canonicalPath: "//example.com",
      currentPath: "/servicos/cabelo/em/goiania-go"
    })).toBeNull();
  });
});
