import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../auth/SessionContext";
import "../styles/public-shell.css";

function isOperationalContext(pathname, session) {
  const adminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const ownerArea = pathname === "/painel" || pathname.startsWith("/painel/");
  const professionalArea = pathname === "/profissional" || pathname.startsWith("/profissional/");
  const contextualAccount =
    pathname === "/conta" && (session.ehAdministrador || session.temNegocio);

  return adminArea || ownerArea || professionalArea || contextualAccount;
}

export function PublicShell({ children }) {
  const location = useLocation();
  const session = useSession();
  const publicContext = !isOperationalContext(location.pathname, session);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("public-context-active", publicContext);

    return () => {
      document.documentElement.classList.remove("public-context-active");
    };
  }, [publicContext]);

  if (!publicContext) {
    return children;
  }

  return (
    <div className="public-shell" data-frontend-context="public">
      {children}
    </div>
  );
}
