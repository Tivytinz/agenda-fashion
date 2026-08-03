// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { resolveMediaUrl } from "./media";

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
});
