import { lazy } from "react";
import { Outlet } from "react-router-dom";
import { useSession } from "../auth/SessionContext";
import {
  MobileWorkspaceNavigation,
  WorkspaceLinks
} from "./WorkspaceNavigation";

const OwnerShell = lazy(() =>
  Promise.all([
    import("../styles/owner-shell.css"),
    import("./OwnerShell")
  ]).then(([, module]) => ({ default: module.OwnerShell }))
);

const PROFESSIONAL_LINKS = [
  ["/profissional/agenda", "Minha agenda", "calendar"],
  ["/profissional/horarios", "Meus horários", "clock"],
  ["/conta", "Minha conta", "account"]
];

export { MobileWorkspaceNavigation } from "./WorkspaceNavigation";

export function NavigationShell({
  ariaLabel,
  children,
  identity,
  links,
  variant = "professional"
}) {
  return (
    <div
      className={`workspace-shell workspace-shell--${variant}`}
      data-frontend-context={variant}
    >
      <aside
        className={identity
          ? "workspace-sidebar"
          : "workspace-sidebar workspace-sidebar--nav-only"}
        aria-label={ariaLabel}
      >
        {identity && (
          <div className="workspace-business">
            <span>{identity.initial}</span>

            <div>
              <strong>{identity.title}</strong>
              <small>{identity.subtitle}</small>
            </div>
          </div>
        )}

        <nav>
          <WorkspaceLinks links={links} />
        </nav>
      </aside>

      <section className="workspace-content">
        {children || <Outlet />}
      </section>

      <MobileWorkspaceNavigation
        ariaLabel={ariaLabel}
        links={links}
      />
    </div>
  );
}

export function WorkspaceLayout({ children }) {
  const { negocio } = useSession();
  const owner = negocio?.papel === "dono";

  if (owner) {
    return <OwnerShell>{children}</OwnerShell>;
  }

  const businessName = negocio?.nome || "Agenda Fashion";

  return (
    <NavigationShell
      ariaLabel="Área de trabalho"
      identity={{
        initial: String(businessName)
          .slice(0, 1)
          .toUpperCase(),
        title: businessName,
        subtitle: "Área profissional"
      }}
      links={PROFESSIONAL_LINKS}
      variant="professional"
    >
      {children}
    </NavigationShell>
  );
}
