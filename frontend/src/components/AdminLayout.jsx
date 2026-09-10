import { AdminShell } from "./AdminShell";
import "../styles/admin-core-finish.css";

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
    <AdminShell links={ADMIN_LINKS}>
      {children}
    </AdminShell>
  );
}
