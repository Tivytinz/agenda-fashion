import {
  Link,
  NavLink,
  useLocation,
  useNavigate
} from "react-router-dom";

import { useSession } from "../auth/SessionContext";
import { getBusinessWorkspacePath } from "../auth/session";
import { AppIcon } from "./AppIcon";

export function AppHeader() {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const accountInAdmin = location.pathname === "/conta" && session.ehAdministrador;
  const adminArea = location.pathname.startsWith("/admin/") || accountInAdmin;
  const businessArea =
    location.pathname.startsWith("/painel") ||
      location.pathname.startsWith("/profissional/") ||
      (
        location.pathname === "/conta" &&
        session.temNegocio &&
        !session.ehAdministrador
      );
  const operationalArea =
    adminArea ||
    businessArea ||
    (
      location.pathname === "/conta" &&
      session.ehAdministrador
    );
  const mobileContextPath = operationalArea
    ? "/"
    : "/minha-agenda";
  const mobileContextLabel = operationalArea
    ? "Explorar"
    : "Minha agenda";

  function handleLogout() {
    session.logout();
    navigate("/", { replace: true });
  }

  const userInitial = String(
    session.usuario?.nome || "U"
  )
    .trim()
    .charAt(0)
    .toLocaleUpperCase("pt-BR");

  return (
    <header className="site-header">
      <div className="container header-content">
        <Link
          className="brand"
          to="/"
          aria-label="Agenda Fashion, início"
        >
          <span
            className="brand-mark"
            aria-hidden="true"
          >
            <AppIcon name="brand" />
          </span>

          <span className="brand-copy">
            <strong>Agenda Fashion</strong>
            <small>Descubra e agende beleza</small>
          </span>
        </Link>

        <nav
          className="public-navigation"
          aria-label="Navegação principal"
        >
          {!operationalArea && (
            <NavLink
              className={({ isActive }) =>
                isActive
                  ? "text-link active desktop-nav-link"
                  : "text-link desktop-nav-link"
              }
              end
              to="/"
            >
              Início
            </NavLink>
          )}

          <NavLink
            className={({ isActive }) =>
              isActive
                ? "text-link active desktop-nav-link mobile-agenda-link"
                : "text-link desktop-nav-link mobile-agenda-link"
            }
            to={mobileContextPath}
          >
            {mobileContextLabel}
          </NavLink>

          {session.authenticated ? (
            <>
              {session.ehAdministrador && !adminArea && (
                <NavLink
                  className="text-link desktop-nav-link"
                  to="/admin/trafego-pago"
                >
                  Administração
                </NavLink>
              )}

              {!businessArea && (!session.ehAdministrador || session.temNegocio) && (
                <NavLink
                  className="text-link desktop-nav-link"
                  to={getBusinessWorkspacePath(session)}
                >
                  {session.temNegocio
                    ? "Área de trabalho"
                    : "Criar negócio"}
                </NavLink>
              )}

              <NavLink
                className="account-button"
                to="/conta"
                aria-label={`Conta de ${session.usuario?.nome || "usuário"}`}
                title="Minha conta"
              >
                <span
                  className="account-avatar"
                  aria-hidden="true"
                >
                  {userInitial}
                </span>

                <span className="account-label">
                  Conta
                </span>
              </NavLink>

              <button
                className="text-button desktop-nav-link"
                onClick={handleLogout}
                type="button"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <NavLink
                className="text-link desktop-nav-link"
                to="/cadastro?tipo=profissional"
              >
                Sou profissional
              </NavLink>

              <NavLink
                className="button button-small"
                to="/entrar"
              >
                Entrar
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
