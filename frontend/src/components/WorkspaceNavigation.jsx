import {
  useEffect,
  useId,
  useRef,
  useState
} from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AppIcon } from "./AppIcon";
import {
  isExactNavigationRoute,
  isWorkspaceRouteActive,
  splitMobileLinks
} from "./workspaceNavigation";

export function WorkspaceLinks({
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

        return isActive ? `${base} active` : base;
      }}
      end={isExactNavigationRoute(to)}
      key={to}
      onClick={onNavigate}
      to={to}
    >
      <span aria-hidden="true"><AppIcon name={icon} /></span>
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
          className={secondaryActive
            ? "workspace-mobile-more active"
            : "workspace-mobile-more"}
          onKeyDown={closeOnEscape}
          ref={moreRef}
        >
          <button
            aria-controls={menuId}
            aria-expanded={menuOpen}
            aria-label={menuOpen
              ? "Fechar mais opções da área de trabalho"
              : "Abrir mais opções da área de trabalho"}
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <span aria-hidden="true"><AppIcon name="more" /></span>
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
