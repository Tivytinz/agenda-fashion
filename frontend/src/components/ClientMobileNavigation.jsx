import { NavLink } from "react-router-dom";
import { AppIcon } from "./AppIcon";

function ClientNavLink({ icon, label, to }) {
  return (
    <NavLink
      className={({ isActive }) =>
        isActive
          ? "client-mobile-nav-link active"
          : "client-mobile-nav-link"}
      to={to}
    >
      <AppIcon name={icon} />
      <span>{label}</span>
    </NavLink>
  );
}

export function ClientMobileNavigation({
  authenticated,
  guestAppointmentAvailable
}) {
  if (authenticated) {
    return (
      <nav
        aria-label="Área da cliente"
        className="client-mobile-nav"
      >
        <ClientNavLink icon="home" label="Descobrir" to="/" />
        <ClientNavLink icon="heart" label="Favoritos" to="/favoritos" />
        <ClientNavLink icon="calendar" label="Agenda" to="/minha-agenda" />
        <ClientNavLink icon="account" label="Conta" to="/cliente/conta" />
      </nav>
    );
  }

  if (!guestAppointmentAvailable) {
    return null;
  }

  return (
    <nav
      aria-label="Área do visitante"
      className="client-mobile-nav client-mobile-nav-guest"
    >
      <ClientNavLink icon="home" label="Descobrir" to="/" />
      <ClientNavLink icon="calendar" label="Meu horário" to="/minha-agenda" />
      <ClientNavLink icon="account" label="Entrar" to="/entrar" />
    </nav>
  );
}
