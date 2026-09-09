import { NavigationShell } from "./WorkspaceLayout";

export const ADMIN_LINKS = [
  ["/admin", "Visão geral", "home"],
  ["/admin/aquisicao", "Aquisição", "marketing"],
  ["/admin/jornada", "Jornada", "health"],
  ["/admin/retencao", "Retenção", "business"],
  ["/admin/receita", "Receita", "plan"],
  ["/admin/operacao", "Operação", "calendar"]
];

export function AdminLayout({ children }) {
  return (
    <NavigationShell
      ariaLabel="Administração do Agenda Fashion"
      identity={null}
      links={ADMIN_LINKS}
      variant="admin"
    >
      {children}
    </NavigationShell>
  );
}
