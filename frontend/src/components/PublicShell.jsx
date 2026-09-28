import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../auth/SessionContext";
import { readRecentAppointment } from "../utils/appointments";
import { ClientMobileNavigation } from "./ClientMobileNavigation";
import "../styles/public-shell.css";

function isClientNavigationRoute(pathname) {
  return (
    pathname === "/" ||
    pathname === "/favoritos" ||
    pathname === "/minha-agenda" ||
    pathname === "/cliente/conta" ||
    pathname === "/sucesso" ||
    pathname.startsWith("/negocio/") ||
    pathname.startsWith("/servicos/") ||
    pathname.startsWith("/agendamento-acesso/") ||
    pathname.startsWith("/agendamento-visitante/")
  );
}

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
  const focusedBooking = location.pathname === "/confirmar";
  const clientNavigationRoute =
    isClientNavigationRoute(location.pathname);
  const guestAppointmentAvailable =
    !session.authenticated &&
    (
      location.pathname === "/minha-agenda" ||
      location.pathname === "/sucesso" ||
      Boolean(readRecentAppointment())
    );
  const showClientNavigation =
    publicContext &&
    clientNavigationRoute &&
    !focusedBooking &&
    (
      session.authenticated ||
      guestAppointmentAvailable
    );

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
      {showClientNavigation && (
        <ClientMobileNavigation
          authenticated={session.authenticated === true}
          guestAppointmentAvailable={guestAppointmentAvailable}
        />
      )}
    </div>
  );
}
