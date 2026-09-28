import { useLayoutEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
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

function ClientMobileNavigation() {
  return (
    <nav aria-label="Navegação da cliente" className="client-mobile-navigation">
      <NavLink end to="/">Descobrir</NavLink>
      <NavLink to="/favoritos">Favoritos</NavLink>
      <NavLink to="/minha-agenda">Agenda</NavLink>
      <NavLink to="/cliente/conta">Conta</NavLink>
    </nav>
  );
}

export function PublicShell({ children }) {
  const location = useLocation();
  const session = useSession();
  const publicContext = !isOperationalContext(location.pathname, session);
  const focusedBooking =
    location.pathname === "/confirmar" ||
    location.pathname === "/sucesso";
  const clientNavigationArea = [
    "/",
    "/favoritos",
    "/minha-agenda",
    "/cliente/conta"
  ].includes(location.pathname);

  const showClientNavigation =
    publicContext &&
    clientNavigationArea &&
    session.authenticated === true &&
    !focusedBooking;

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
    <div
      className={showClientNavigation
        ? "public-shell client-navigation-active"
        : "public-shell"}
      data-frontend-context="public"
    >
      {children}
      {showClientNavigation && <ClientMobileNavigation />}
    </div>
  );
}
