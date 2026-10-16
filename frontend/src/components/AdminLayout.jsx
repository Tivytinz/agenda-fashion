import { AdminShell } from "./AdminShell";
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
      { path: "/admin/whatsapp", label: "WhatsApp" },
      { path: "/admin/auditoria", label: "Auditoria" }
    ]
  }
];

export function AdminLayout({ children }) {
  return (
    <AdminShell groups={ADMIN_NAV_GROUPS}>
      {children}
    </AdminShell>
  );
}
