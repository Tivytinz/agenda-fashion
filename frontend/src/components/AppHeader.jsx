import {
  Link,
  NavLink,
  useLocation,
  useNavigate
} from "react-router-dom";

import { useSession } from "../auth/SessionContext";
import { getBusinessWorkspacePath } from "../auth/session";
import afLogoTransparent from "../assets/brand/af-logo-transparent.png";

export function AppHeader() {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const accountInAdmin = location.pathname === "/conta" && session.ehAdministrador;
  const focusedProfessionalLanding =
    location.pathname === "/para-profissionais" &&
    !session.authenticated;
  const homePage = location.pathname === "/";
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
    <header className={homePage
      ? "site-header home-site-header"
      : "site-header"}
    >
      <div className="container header-content">
        <Link
          className="brand"
          to={focusedProfessionalLanding
            ? "/para-profissionais"
            : "/"}
          aria-label="Agenda Fashion, início"
        >
          <span
            className="brand-mark"
            aria-hidden="true"
          >
            <img
              alt=""
              className="header-brand-logo"
              height="48"
              src={afLogoTransparent}
              width="48"
            />
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
          {!focusedProfessionalLanding && (
            <NavLink
              className={({ isActive }) =>
                isActive
                  ? "text-link active desktop-nav-link mobile-home-link"
                  : "text-link desktop-nav-link mobile-home-link"
              }
              end
              to="/"
            >
              Início
            </NavLink>
          )}

          {session.authenticated ? (
            <>
              {!operationalArea && (
                <NavLink
                  className="text-link desktop-nav-link"
                  to="/conta#notificacoes-whatsapp"
                >
                  Mensagens
                </NavLink>
              )}
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
              {!focusedProfessionalLanding && (
                <NavLink
                  className="text-link desktop-nav-link"
                  to="/para-profissionais"
                >
                  Sou profissional
                </NavLink>
              )}

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
