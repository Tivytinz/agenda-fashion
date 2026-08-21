import { describe, expect, it } from "vitest";

import {
  buildLocalCatalogPath,
  slugifyLocalPart
} from "./localCatalog";


describe("links do catálogo local", () => {
  it("normaliza cidade com acentos e inclui a UF", () => {
    expect(slugifyLocalPart("São José dos Campos"))
      .toBe("sao-jose-dos-campos");

    expect(buildLocalCatalogPath({
      category: "cabelo",
      city: "Goiânia",
      state: "GO"
    })).toBe(
      "/servicos/cabelo/em/goiania-go"
    );
  });

  it("mapeia a categoria interna para a URL canônica", () => {
    expect(buildLocalCatalogPath({
      category: "unha",
      city: "Belém",
      state: "PA"
    })).toBe(
      "/servicos/unhas/em/belem-pa"
    );
  });

  it("cria o link local de Bronzeamento", () => {
    expect(buildLocalCatalogPath({
      category: "bronzeamento",
      city: "Carápolis",
      state: "SP"
    })).toBe(
      "/servicos/bronzeamento/em/carapolis-sp"
    );
  });

  it("não cria link local sem dados suficientes", () => {
    expect(buildLocalCatalogPath({
      category: "outro",
      city: "Goiânia",
      state: "GO"
    })).toBeNull();

    expect(buildLocalCatalogPath({
      category: "cabelo",
      city: "Goiânia",
      state: ""
    })).toBeNull();
  });
});
