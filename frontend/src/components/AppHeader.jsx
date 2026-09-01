import {
  useEffect,
  useState
} from "react";

import {
  Link,
  NavLink,
  useLocation,
  useNavigate
} from "react-router-dom";

import { useSession } from "../auth/SessionContext";
import { getBusinessWorkspacePath } from "../auth/session";
import afLogoTransparent from "../assets/brand/af-logo-transparent.png";
import { MediaThumb } from "./profile/MediaThumb";

export function AppHeader() {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const accountInAdmin =
    location.pathname === "/conta" &&
    session.ehAdministrador;

  const focusedProfessionalLanding =
    location.pathname === "/para-profissionais" &&
    !session.authenticated;

  const homePage = location.pathname === "/";

  const adminArea =
    location.pathname.startsWith("/admin/") ||
    accountInAdmin;

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

  const showDiscoveryNavigation =
    !focusedProfessionalLanding &&
    !operationalArea;

  useEffect(() => {
    if (!homePage) {
      return;
    }

    setSearch(
      new URLSearchParams(location.search)
        .get("busca") || ""
    );
  }, [homePage, location.search]);

  function handleLogout() {
    session.logout();
    navigate("/", { replace: true });
  }

  function handleSearch(event) {
    event.preventDefault();

    const query = search.trim();
    const destination = query
      ? `/?busca=${encodeURIComponent(query)}#buscar-servicos`
      : "/#buscar-servicos";

    navigate(destination);
  }

  const userInitial = String(
    session.usuario?.nome || "U"
  )
    .trim()
    .charAt(0)
    .toLocaleUpperCase("pt-BR");

  const workspaceLabel = session.temNegocio
    ? "Área de trabalho"
    : "Criar negócio";

  const headerClassName = [
    "site-header",
    homePage ? "home-site-header" : "",
    adminArea ? "admin-site-header" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName}>
      <div className="container header-content">
        <Link
          aria-label={adminArea ? "Agenda Fashion Admin" : "Agenda Fashion, início"}
          className="brand"
          to={adminArea
            ? "/admin/saude"
            : focusedProfessionalLanding
              ? "/para-profissionais"
              : "/"}
        >
          <span
            aria-hidden="true"
            className="brand-mark"
          >
            <img
              alt=""
              className="header-brand-logo"
              height="72"
              src={afLogoTransparent}
              width="72"
            />
          </span>

          <span className="brand-copy">
            <strong>{adminArea ? "AF Admin" : "Agenda Fashion"}</strong>
            <small>{adminArea ? "Operação interna" : "Descubra e agende beleza"}</small>
          </span>
        </Link>

        <nav
          aria-label="Navegação principal"
          className="public-navigation"
        >
          {!focusedProfessionalLanding && (
            <NavLink
              className={({ isActive }) =>
                isActive
                  ? "text-link active header-main-link mobile-home-link"
                  : "text-link header-main-link mobile-home-link"}
              end
              to="/"
            >
              Início
            </NavLink>
          )}

          {showDiscoveryNavigation && (
            <>
              <NavLink
                className="text-link header-main-link"
                to="/favoritos"
              >
                Favoritos
              </NavLink>

              <NavLink
                className="text-link header-main-link"
                to="/minha-agenda"
              >
                Meus agendamentos
              </NavLink>
            </>
          )}

          {showDiscoveryNavigation && (
            <form
              aria-label="Buscar no Agenda Fashion"
              className="header-search"
              onSubmit={handleSearch}
              role="search"
            >
              <span
                aria-hidden="true"
                className="header-search-icon"
              >
                ⌕
              </span>

              <label className="sr-only" htmlFor="header-search-input">
                Busque por serviço, profissional ou cidade
              </label>

              <input
                id="header-search-input"
                onChange={(event) =>
                  setSearch(event.target.value)}
                placeholder="Busque serviços ou profissionais"
                type="search"
                value={search}
              />
            </form>
          )}

          {session.authenticated ? (
            <details className="header-account-menu">
              <summary
                aria-label={`Abrir conta de ${session.usuario?.nome || "usuário"}`}
                role="button"
                title="Minha conta"
              >
                <MediaThumb
                  alt={`Foto de ${session.usuario?.nome || "usuário"}`}
                  className="header-account-avatar"
                  emoji={userInitial}
                  src={session.usuario?.foto_url}
                />

                <span
                  aria-hidden="true"
                  className="header-account-chevron"
                >
                  ⌄
                </span>
              </summary>

              <div className="header-account-popover">
                <NavLink to="/conta">
                  Minha conta
                </NavLink>

                {session.ehAdministrador && !adminArea && (
                  <NavLink to="/admin/trafego-pago">
                    Administração
                  </NavLink>
                )}

                {!businessArea &&
                  (!session.ehAdministrador || session.temNegocio) && (
                  <NavLink to={getBusinessWorkspacePath(session)}>
                    {workspaceLabel}
                  </NavLink>
                )}

                <button
                  onClick={handleLogout}
                  type="button"
                >
                  Sair
                </button>
              </div>
            </details>
          ) : focusedProfessionalLanding ? (
            <NavLink
              className="button button-small"
              to="/entrar"
            >
              Entrar
            </NavLink>
          ) : (
            <NavLink
              aria-label="Entrar na sua conta"
              className="header-guest-account"
              title="Entrar"
              to="/entrar"
            >
              <span
                aria-hidden="true"
                className="header-guest-avatar"
              >
                ♡
              </span>

              <span
                aria-hidden="true"
                className="header-account-chevron"
              >
                ⌄
              </span>
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
