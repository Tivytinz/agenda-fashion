import {
  describe,
  expect,
  it
} from "vitest";
import { ADMIN_LINKS } from "./AdminLayout";

describe("navegação administrativa", () => {
  it("mantém apenas módulos do AF no nível principal", () => {
    expect(ADMIN_LINKS).toEqual([
      ["/admin", "Visão geral", "home"],
      ["/admin/aquisicao", "Aquisição", "marketing"],
      ["/admin/jornada", "Jornada", "health"],
      ["/admin/retencao", "Retenção", "business"],
      ["/admin/receita", "Receita", "plan"],
      ["/admin/operacao", "Operação", "calendar"]
    ]);
    expect(ADMIN_LINKS.some(([path]) => path === "/conta")).toBe(false);
  });
});
