import { useLayoutEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import { useSession } from "../auth/SessionContext";
import afLogoTransparent from "../assets/brand/af-logo-transparent.png";
import { AppIcon } from "./AppIcon";
import {
  MobileWorkspaceNavigation,
  WorkspaceLinks
} from "./WorkspaceNavigation";

export function ProfessionalShell({ children, links = [] }) {
  const { negocio } = useSession();
  const businessName = negocio?.nome || "Agenda Fashion";
  const initial = String(businessName).slice(0, 1).toUpperCase();

  useLayoutEffect(() => {
    document.documentElement.classList.add("professional-context-active");

    return () => {
      document.documentElement.classList.remove("professional-context-active");
    };
  }, []);

  return (
    <div className="professional-shell" data-frontend-context="professional">
      <aside className="professional-sidebar" aria-label="Área profissional">
        <Link
          aria-label="Agenda Fashion, minha agenda"
          className="professional-brand"
          to="/profissional/agenda"
        >
          <span aria-hidden="true" className="professional-brand-mark">
            <img
              alt=""
              height="54"
              src={afLogoTransparent}
              width="54"
            />
          </span>
          <span className="professional-brand-copy">
            <strong>Agenda Fashion</strong>
            <small>Área profissional</small>
          </span>
        </Link>

        <section
          aria-label="Negócio atual"
          className="professional-business-context"
        >
          <span aria-hidden="true" className="professional-business-initial">
            {initial}
          </span>
          <div>
            <strong>{businessName}</strong>
            <small>Sua rotina de atendimento</small>
          </div>
        </section>

        <nav aria-label="Rotina profissional" className="professional-navigation">
          <WorkspaceLinks links={links} />
        </nav>
      </aside>

      <div className="professional-surface">
        <header className="professional-topbar">
          <div className="professional-topbar-context">
            <small>Área profissional</small>
            <strong>{businessName}</strong>
          </div>

          <Link
            aria-label="Abrir minha conta"
            className="professional-account-link"
            to="/conta"
          >
            <AppIcon name="account" />
            <span>Conta</span>
          </Link>
        </header>

        <section className="professional-content">
          {children || <Outlet />}
        </section>
      </div>

      <MobileWorkspaceNavigation
        ariaLabel="Rotina profissional"
        links={links}
      />
    </div>
  );
}
