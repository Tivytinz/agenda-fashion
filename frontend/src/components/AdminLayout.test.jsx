import {
  describe,
  expect,
  it
} from "vitest";
import { ADMIN_LINKS } from "./AdminLayout";

describe("navegação administrativa", () => {
  it("mantém apenas módulos do AF no nível principal", () => {
    expect(ADMIN_LINKS).toEqual([
      { path: "/admin", label: "Visão geral", icon: "home", mobile: "primary" },
      { path: "/admin/aquisicao", label: "Aquisição", icon: "marketing", mobile: "primary" },
      { path: "/admin/jornada", label: "Jornada", icon: "health", mobile: "primary" },
      { path: "/admin/retencao", label: "Retenção", icon: "business", mobile: "primary" },
      { path: "/admin/receita", label: "Receita", icon: "plan", mobile: "secondary" },
      { path: "/admin/operacao", label: "Operação", icon: "calendar", mobile: "secondary" }
    ]);
    expect(ADMIN_LINKS.some(({ path }) => path === "/conta")).toBe(false);
  });

  it("declara explicitamente quais módulos ficam na barra mobile", () => {
    expect(ADMIN_LINKS.filter(({ mobile }) => mobile === "primary").map(({ path }) => path))
      .toEqual(["/admin", "/admin/aquisicao", "/admin/jornada", "/admin/retencao"]);
    expect(ADMIN_LINKS.filter(({ mobile }) => mobile === "secondary").map(({ path }) => path))
      .toEqual(["/admin/receita", "/admin/operacao"]);
  });
});
