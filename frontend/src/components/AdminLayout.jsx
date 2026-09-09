import {
  ADMIN_LINKS,
  AdminShell
} from "./AdminShell";

export { ADMIN_LINKS };

export function AdminLayout({ children }) {
  return (
    <AdminShell>
      {children}
    </AdminShell>
  );
}
