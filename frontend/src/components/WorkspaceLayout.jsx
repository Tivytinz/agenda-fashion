import {
  useEffect,
  useId,
  useRef,
  useState
} from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../auth/SessionContext";
import {
  isExactNavigationRoute,
  isWorkspaceRouteActive,
  splitMobileLinks
} from "./workspaceNavigation";

const OWNER_LINKS = [
  ["/painel", "Visão geral", "⌂"],
  ["/painel/agenda", "Agenda", "▦"],
  ["/painel/servicos", "Serviços", "✦"],
  ["/painel/profissionais", "Equipe", "♙"],
  ["/painel/horarios", "Horários", "◷"],
  ["/painel/negocio", "Meu negócio", "◇"],
  ["/painel/assinatura", "Plano e assinatura", "◉"],
  ["/conta", "Minha conta", "○"]
];

const PROFESSIONAL_LINKS = [
  ["/profissional/agenda", "Minha agenda", "▦"],
  ["/profissional/horarios", "Meus horários", "◷"],
  ["/conta", "Minha conta", "○"]
];

export const ADMIN_LINKS = [
  ["/admin/trafego-pago", "Marketing", "↗"],
  ["/admin/trafego-pago/custos", "Custos", "R$"],
  ["/admin/trafego-pago/profissionais", "Funil", "◇"],
  ["/conta", "Minha conta", "○"]
];

function WorkspaceLinks({
  links,
  mobile = false,
  menu = false,
  onNavigate
}) {
  return links.map(([to, label, icon]) => (
    <NavLink
      className={({ isActive }) => {
        const base = menu
          ? "workspace-mobile-menu-link"
          : mobile
            ? "workspace-mobile-link"
            : "workspace-link";

        return isActive
          ? `${base} active`
          : base;
      }}
      end={isExactNavigationRoute(to)}
      key={to}
      onClick={onNavigate}
      to={to}
    >
      <span aria-hidden="true">{icon}</span>
      <small>{label}</small>
    </NavLink>
  ));
}

export function MobileWorkspaceNavigation({
  ariaLabel = "Navegação da área de trabalho",
  links
}) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const moreRef = useRef(null);
  const { primary, secondary } = splitMobileLinks(links);
  const secondaryActive = secondary.some(([to]) =>
    isWorkspaceRouteActive(pathname, to)
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function closeOnOutsideClick(event) {
      if (!moreRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [menuOpen]);

  function closeOnEscape(event) {
    if (event.key === "Escape" && menuOpen) {
      setMenuOpen(false);
      moreRef.current?.querySelector("button")?.focus();
    }
  }

  return (
    <nav
      className="workspace-mobile-nav"
      aria-label={ariaLabel}
    >
      <WorkspaceLinks links={primary} mobile />

      {secondary.length > 0 && (
        <div
          className={
            secondaryActive
              ? "workspace-mobile-more active"
              : "workspace-mobile-more"
          }
          onKeyDown={closeOnEscape}
          ref={moreRef}
        >
          <button
            aria-controls={menuId}
            aria-expanded={menuOpen}
            aria-label={
              menuOpen
                ? "Fechar mais opções da área de trabalho"
                : "Abrir mais opções da área de trabalho"
            }
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <span aria-hidden="true">•••</span>
            <small>Mais</small>
          </button>

          {menuOpen && (
            <div
              aria-label="Mais opções da área de trabalho"
              className="workspace-mobile-menu"
              id={menuId}
            >
              <WorkspaceLinks
                links={secondary}
                menu
                onNavigate={() => setMenuOpen(false)}
              />
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

function NavigationShell({
  ariaLabel,
  children,
  identity,
  links
}) {
  return (
    <div className="workspace-shell">
      <aside
        className="workspace-sidebar"
        aria-label={ariaLabel}
      >
        <div className="workspace-business">
          <span>{identity.initial}</span>

          <div>
            <strong>{identity.title}</strong>
            <small>{identity.subtitle}</small>
          </div>
        </div>

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

export function AdminLayout({ children }) {
  return (
    <NavigationShell
      ariaLabel="Administração do Agenda Fashion"
      identity={{
        initial: "AF",
        title: "Agenda Fashion",
        subtitle: "Administração global"
      }}
      links={ADMIN_LINKS}
    >
      {children}
    </NavigationShell>
  );
}

export function WorkspaceLayout({ children }) {
  const { negocio } = useSession();
  const owner = negocio?.papel === "dono";
  const links = owner ? OWNER_LINKS : PROFESSIONAL_LINKS;
  const businessName = negocio?.nome || "Agenda Fashion";

  return (
    <NavigationShell
      ariaLabel="Área de trabalho"
      identity={{
        initial: String(businessName)
          .slice(0, 1)
          .toUpperCase(),
        title: businessName,
        subtitle: owner
          ? "Administração do negócio"
          : "Área profissional"
      }}
      links={links}
    >
      {children}
    </NavigationShell>
  );
}
