import { AdminShell } from "./AdminShell";
import "../styles/admin-core-finish.css";

export const ADMIN_LINKS = [
  { path: "/admin", label: "Visão geral", icon: "home", mobile: "primary" },
  { path: "/admin/aquisicao", label: "Aquisição", icon: "marketing", mobile: "primary" },
  { path: "/admin/jornada", label: "Jornada", icon: "health", mobile: "primary" },
  { path: "/admin/retencao", label: "Retenção", icon: "business", mobile: "primary" },
  { path: "/admin/receita", label: "Receita", icon: "plan", mobile: "secondary" },
  { path: "/admin/operacao", label: "Operação", icon: "calendar", mobile: "secondary" }
];

export function AdminLayout({ children }) {
  return (
    <AdminShell links={ADMIN_LINKS}>
      {children}
    </AdminShell>
  );
}
