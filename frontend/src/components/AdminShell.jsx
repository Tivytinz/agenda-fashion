import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation
} from "react-router-dom";
import afLogoTransparent from "../assets/brand/af-logo-transparent.png";
import { AppIcon } from "./AppIcon";

function isAdminRouteActive(pathname, route) {
  if (route === "/admin") return pathname === route;
  return pathname === route || pathname.startsWith(`${route}/`);
}

function AdminNavLinks({ links, mobile = false, menu = false, onNavigate }) {
  return links.map(([to, label, icon]) => (
    <NavLink
      className={({ isActive }) => {
        const base = menu
          ? "admin-mobile-menu-link"
          : mobile
            ? "admin-mobile-link"
            : "admin-nav-link";

        return isActive ? `${base} active` : base;
      }}
      end={to === "/admin"}
      key={to}
      onClick={onNavigate}
      to={to}
    >
      <span aria-hidden="true" className="admin-nav-icon">
        <AppIcon name={icon} />
      </span>
      <small>{label}</small>
    </NavLink>
  ));
}

export function AdminMobileNavigation({ links = [] }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const moreRef = useRef(null);
  const primary = links.slice(0, 4);
  const secondary = links.slice(4);
  const secondaryActive = secondary.some(([to]) =>
    isAdminRouteActive(pathname, to)
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
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [menuOpen]);

  function closeOnEscape(event) {
    if (event.key !== "Escape" || !menuOpen) return;
    setMenuOpen(false);
    moreRef.current?.querySelector("button")?.focus();
  }

  return (
    <nav
      aria-label="Navegação mobile da administração"
      className="admin-mobile-nav"
    >
      <AdminNavLinks links={primary} mobile />

      {secondary.length > 0 && (
        <div
          className={secondaryActive
            ? "admin-mobile-more active"
            : "admin-mobile-more"}
          onKeyDown={closeOnEscape}
          ref={moreRef}
        >
          <button
            aria-controls={menuId}
            aria-expanded={menuOpen}
            aria-label={menuOpen
              ? "Fechar mais opções da administração"
              : "Abrir mais opções da administração"}
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <span aria-hidden="true" className="admin-nav-icon">
              <AppIcon name="more" />
            </span>
            <small>Mais</small>
          </button>

          {menuOpen && (
            <div
              aria-label="Mais opções da administração"
              className="admin-mobile-menu"
              id={menuId}
            >
              <AdminNavLinks
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

export function AdminShell({ children, links = [] }) {
  useLayoutEffect(() => {
    document.documentElement.classList.add("admin-context-active");

    return () => {
      document.documentElement.classList.remove("admin-context-active");
    };
  }, []);

  return (
    <div className="admin-shell" data-frontend-context="admin">
      <aside
        aria-label="Administração do Agenda Fashion"
        className="admin-sidebar"
      >
        <Link
          aria-label="Agenda Fashion Admin, visão geral"
          className="admin-brand"
          to="/admin"
        >
          <span aria-hidden="true" className="admin-brand-mark">
            <img
              alt=""
              height="64"
              src={afLogoTransparent}
              width="64"
            />
          </span>
          <span className="admin-brand-copy">
            <strong>Agenda Fashion</strong>
            <small>Command Center</small>
          </span>
        </Link>

        <div className="admin-nav-section">
          <span className="admin-nav-caption">GESTÃO DO SAAS</span>
          <nav aria-label="Módulos administrativos">
            <AdminNavLinks links={links} />
          </nav>
        </div>

        <div className="admin-sidebar-footer">
          <span className="admin-environment-dot" aria-hidden="true" />
          <div>
            <strong>Ambiente interno</strong>
            <small>Dados e operação do AF</small>
          </div>
        </div>
      </aside>

      <div className="admin-surface">
        <header className="admin-topbar">
          <div className="admin-topbar-context">
            <small>Agenda Fashion</small>
            <strong>Command Center</strong>
          </div>

          <div className="admin-topbar-actions">
            <Link className="admin-topbar-link" to="/">
              Ver produto
            </Link>
            <Link
              aria-label="Abrir minha conta"
              className="admin-account-link"
              to="/conta"
            >
              <AppIcon name="account" />
              <span>Conta</span>
            </Link>
          </div>
        </header>

        <section className="admin-content">
          {children || <Outlet />}
        </section>
      </div>

      <AdminMobileNavigation links={links} />
    </div>
  );
}
