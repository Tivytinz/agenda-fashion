import { describe, expect, it } from "vitest";
import reactRoutes from "../../../src/config/reactRoutes.json";
import { ADMIN_NAV_GROUPS, adminNavGroupsForRole } from "./AdminLayout";

describe("navegação administrativa", () => {
  it("inclui todas as páginas administrativas autorizadas na navegação", () => {
    expect(ADMIN_NAV_GROUPS.map(({ label }) => label)).toEqual([
      "Início", "Crescimento", "Plataforma"
    ]);
    expect(ADMIN_NAV_GROUPS.flatMap(({ links }) => links.map(({ path }) => path)))
      .toEqual([
        "/admin",
        "/admin/trafego-pago",
        "/admin/trafego-pago/custos",
        "/admin/integracoes",
        "/admin/aquisicao",
        "/admin/jornada",
        "/admin/retencao",
        "/admin/receita",
        "/admin/operacao",
        "/admin/saude",
        "/admin/whatsapp"
      ]);
    expect(adminNavGroupsForRole("admin").flatMap(({ links }) => links.map(({ path }) => path)))
      .not.toContain("/admin/auditoria");
    expect(adminNavGroupsForRole("superadmin").flatMap(({ links }) => links.map(({ path }) => path)))
      .toContain("/admin/auditoria");
  });

  it("dá um link direto a cada rota administrativa atual", () => {
    const currentAdminRoutes = Object.entries(reactRoutes)
      .filter(([name]) => name.startsWith("admin") && name !== "adminProfessionals")
      .map(([, path]) => path);
    const visibleRoutes = adminNavGroupsForRole("superadmin")
      .flatMap(({ links }) => links.map(({ path }) => path));

    expect([...visibleRoutes].sort()).toEqual([...currentAdminRoutes].sort());
  });
});
