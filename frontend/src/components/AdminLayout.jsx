import { AdminShell } from "./AdminShell";
import { useOptionalSession } from "../auth/SessionContext";
import "../styles/admin-core-finish.css";

export const ADMIN_NAV_GROUPS = [
  {
    label: "Início",
    links: [{ path: "/admin", label: "Visão geral" }]
  },
  {
    label: "Crescimento",
    links: [
      { path: "/admin/trafego-pago", label: "Marketing" },
      { path: "/admin/trafego-pago/custos", label: "Investimento e eficiência" },
      { path: "/admin/integracoes", label: "Integrações" },
      { path: "/admin/aquisicao", label: "Aquisição" },
      { path: "/admin/jornada", label: "Jornada" },
      { path: "/admin/retencao", label: "Retenção" },
      { path: "/admin/receita", label: "Receita" }
    ]
  },
  {
    label: "Plataforma",
    links: [
      { path: "/admin/operacao", label: "Operação" },
      { path: "/admin/saude", label: "Saúde do SaaS" },
      { path: "/admin/whatsapp", label: "WhatsApp" }
    ]
  }
];

export function adminNavGroupsForRole(role) {
  if (role !== "superadmin") return ADMIN_NAV_GROUPS;
  return ADMIN_NAV_GROUPS.map((group) => group.label === "Plataforma"
    ? { ...group, links: [...group.links, { path: "/admin/auditoria", label: "Auditoria" }] }
    : group);
}

export function AdminLayout({ children }) {
  const role = useOptionalSession()?.administrador?.papel;
  return (
    <AdminShell groups={adminNavGroupsForRole(role)}>
      {children}
    </AdminShell>
  );
}
