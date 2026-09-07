import { NavigationShell } from "./WorkspaceLayout";

export const ADMIN_LINKS = [
  ["/admin", "Visão geral", "home"],
  ["/admin/saude", "Ativação", "health"],
  ["/admin/operacao", "Operação", "business"],
  ["/admin/trafego-pago", "Marketing", "marketing"],
  ["/admin/whatsapp", "WhatsApp", "whatsapp"],
  ["/conta", "Minha conta", "account"]
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
