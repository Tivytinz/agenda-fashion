import { describe, expect, it } from "vitest";
import { ADMIN_NAV_GROUPS } from "./AdminLayout";

describe("navegação administrativa", () => {
  it("organiza os oito módulos em uma única fonte para desktop e celular", () => {
    expect(ADMIN_NAV_GROUPS.map(({ label }) => label)).toEqual([
      "Início", "Crescimento", "Plataforma"
    ]);
    expect(ADMIN_NAV_GROUPS.flatMap(({ links }) => links.map(({ path }) => path)))
      .toEqual([
        "/admin",
        "/admin/trafego-pago",
        "/admin/aquisicao",
        "/admin/jornada",
        "/admin/retencao",
        "/admin/receita",
        "/admin/operacao",
        "/admin/saude"
      ]);
  });
});
