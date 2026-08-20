// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { resolveMediaUrl, withMediaRetry } from "./media";

describe("resolveMediaUrl", () => {
  it("mantém URL absoluta segura", () => {
    expect(resolveMediaUrl(
      "https://res.cloudinary.com/demo/foto.jpg"
    )).toBe(
      "https://res.cloudinary.com/demo/foto.jpg"
    );
  });

  it("resolve caminho relativo usando a origem da aplicação", () => {
    expect(resolveMediaUrl("/uploads/servico.jpg"))
      .toBe("http://localhost:3000/uploads/servico.jpg");
  });

  it("não cria URL para valor vazio", () => {
    expect(resolveMediaUrl(null)).toBe("");
  });

  it("otimiza imagens do Cloudinary para a largura exibida", () => {
    expect(resolveMediaUrl(
      "https://res.cloudinary.com/demo/image/upload/v1/foto.jpg",
      { width: 480 }
    )).toContain("/image/upload/f_auto,q_auto,c_fill,w_480/");
  });

  it("preserva a imagem completa quando o componente solicita contain", () => {
    expect(resolveMediaUrl(
      "https://res.cloudinary.com/demo/image/upload/v1/foto.jpg",
      { width: 520, fit: "contain" }
    )).toContain("/image/upload/f_auto,q_auto,c_fit,w_520/");
  });

  it("gera uma URL diferente para a nova tentativa", () => {
    expect(withMediaRetry("https://img.exemplo/foto.jpg", 1))
      .toContain("af_retry=1");
  });
});
