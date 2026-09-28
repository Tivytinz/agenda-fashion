import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import afLogoTransparent from "../assets/brand/performance/af-logo-96.webp";
import { adminNavigationPath } from "../utils/adminPeriods";
import { AppIcon } from "./AppIcon";

function isAdminSectionActive(pathname, path) {
  if (path === "/admin/aquisicao" && pathname === "/admin/trafego-pago/profissionais") return true;
  return pathname === path;
}

function AdminNavigation({ groups, mobile = false, onNavigate }) {
  const { pathname, search } = useLocation();
  const prefix = mobile ? "admin-mobile" : "admin-desktop";

  return (
    <nav aria-label={mobile
      ? "Navegação mobile da administração"
      : "Módulos administrativos"}
    >
      {groups.map(({ label, links }, index) => (
        <div className="admin-nav-section" key={label}>
          <h2 className="admin-nav-caption" id={`${prefix}-group-${index}`}>
            {label}
          </h2>
          <div aria-labelledby={`${prefix}-group-${index}`} className="admin-nav-list">
            {links.map(({ path, label: linkLabel }) => (
              <Link
                aria-current={pathname === path
                  ? "page"
                  : isAdminSectionActive(pathname, path) ? "location" : undefined}
                className={isAdminSectionActive(pathname, path)
                  ? "admin-nav-link active"
                  : "admin-nav-link"}
                key={path}
                onClick={onNavigate}
                to={adminNavigationPath(path, search)}
              >
                {linkLabel}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminMobileNavigation({ groups = [] }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mobileViewport = window.matchMedia("(max-width: 900px)");
    const closeOnDesktop = () => {
      if (!mobileViewport.matches) setOpen(false);
    };

    mobileViewport.addEventListener("change", closeOnDesktop);
    return () => mobileViewport.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <>
      <button
        aria-controls={dialogId}
        aria-expanded={open}
        className="admin-menu-button"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span aria-hidden="true" className="admin-menu-mark" />
        Menu
      </button>

      <dialog
        aria-label="Menu da administração"
        className="admin-mobile-drawer"
        id={dialogId}
        onCancel={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
          if (event.clientX < left || event.clientX > right
            || event.clientY < top || event.clientY > bottom) setOpen(false);
        }}
        onClose={() => setOpen(false)}
        ref={dialogRef}
      >
        <div className="admin-mobile-drawer-header">
          <strong>Administração</strong>
          <button
            aria-label="Fechar menu"
            className="admin-menu-close"
            onClick={() => setOpen(false)}
            type="button"
          >
            Fechar
          </button>
        </div>
        <AdminNavigation
          groups={groups}
          mobile
          onNavigate={() => setOpen(false)}
        />
        <Link
          className="admin-product-link"
          onClick={() => setOpen(false)}
          to="/"
        >
          Ver produto
        </Link>
      </dialog>
    </>
  );
}

export function AdminShell({ children, groups = [] }) {
  const { search } = useLocation();

  useLayoutEffect(() => {
    document.documentElement.classList.add("admin-context-active");
    return () => {
      document.documentElement.classList.remove("admin-context-active");
    };
  }, []);

  return (
    <div className="admin-shell" data-frontend-context="admin">
      <a className="admin-skip-link" href="#admin-main">Pular para o conteúdo</a>

      <aside aria-label="Administração do Agenda Fashion" className="admin-sidebar">
        <Link
          aria-label="Agenda Fashion Admin, visão geral"
          className="admin-brand"
          to={adminNavigationPath("/admin", search)}
        >
          <span aria-hidden="true" className="admin-brand-mark">
            <img alt="" height="64" src={afLogoTransparent} width="64" />
          </span>
          <span className="admin-brand-copy">
            <strong>Agenda Fashion</strong>
            <small>Administração</small>
          </span>
        </Link>

        <AdminNavigation groups={groups} />
        <div className="admin-sidebar-footer">
          <Link className="admin-product-link" to="/">Ver produto</Link>
        </div>
      </aside>

      <div className="admin-surface">
        <header className="admin-topbar">
          <AdminMobileNavigation groups={groups} />
          <strong className="admin-topbar-title">Administração</strong>
          <Link aria-label="Abrir minha conta" className="admin-account-link" to="/conta">
            <AppIcon name="account" />
            <span>Conta</span>
          </Link>
        </header>

        <div className="admin-content" id="admin-main" tabIndex={-1}>
          {children || <Outlet />}
        </div>
      </div>
    </div>
  );
}
