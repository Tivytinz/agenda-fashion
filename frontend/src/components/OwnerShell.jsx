import { useLayoutEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import { useSession } from "../auth/SessionContext";
import afLogoTransparent from "../assets/brand/af-logo-transparent.png";
import { AppIcon } from "./AppIcon";
import {
  MobileWorkspaceNavigation,
  WorkspaceLinks
} from "./WorkspaceNavigation";

function publicProfilePath(slug) {
  const normalized = String(slug || "").trim();
  return normalized ? `/negocio/${encodeURIComponent(normalized)}` : "";
}

export function OwnerShell({ children, links = [] }) {
  const { negocio } = useSession();
  const businessName = negocio?.nome || "Meu negócio";
  const profilePath = publicProfilePath(negocio?.slug);
  const initial = String(businessName).slice(0, 1).toUpperCase();

  useLayoutEffect(() => {
    document.documentElement.classList.add("owner-context-active");

    return () => {
      document.documentElement.classList.remove("owner-context-active");
    };
  }, []);

  return (
    <div className="owner-shell" data-frontend-context="owner">
      <aside className="owner-sidebar" aria-label="Gestão do negócio">
        <Link
          aria-label="Agenda Fashion, visão geral do negócio"
          className="owner-brand"
          to="/painel"
        >
          <span aria-hidden="true" className="owner-brand-mark">
            <img
              alt=""
              height="58"
              src={afLogoTransparent}
              width="58"
            />
          </span>
          <span className="owner-brand-copy">
            <strong>Agenda Fashion</strong>
            <small>Gestão do negócio</small>
          </span>
        </Link>

        <section className="owner-business-context" aria-label="Negócio atual">
          <span aria-hidden="true" className="owner-business-initial">{initial}</span>
          <div>
            <strong>{businessName}</strong>
            <small>Área da dona</small>
          </div>
        </section>

        <nav aria-label="Área de trabalho" className="owner-navigation">
          <WorkspaceLinks links={links} />
        </nav>

        <div className="owner-sidebar-footer">
          <span aria-hidden="true" className="owner-environment-dot" />
          <div>
            <strong>Seu espaço de gestão</strong>
            <small>Agenda, serviços e crescimento</small>
          </div>
        </div>
      </aside>

      <div className="owner-surface">
        <header className="owner-topbar">
          <div className="owner-topbar-context">
            <small>Gestão do negócio</small>
            <strong>{businessName}</strong>
          </div>

          <div className="owner-topbar-actions">
            {profilePath && (
              <Link className="owner-topbar-link" to={profilePath}>
                Ver perfil
              </Link>
            )}
            <Link
              aria-label="Abrir minha conta"
              className="owner-account-link"
              to="/conta"
            >
              <AppIcon name="account" />
              <span>Conta</span>
            </Link>
          </div>
        </header>

        <section className="owner-content">
          {children || <Outlet />}
        </section>
      </div>

      <MobileWorkspaceNavigation
        ariaLabel="Área de trabalho"
        links={links}
      />
    </div>
  );
}
