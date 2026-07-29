import { Link, NavLink } from "react-router-dom";
import { useSession } from "../auth/SessionContext";
import { getWorkspacePath } from "../auth/session";

export function AppHeader() {
  const session = useSession();

  return (
    <header className="site-header">
      <div className="container header-content">
        <Link className="brand" to="/" aria-label="Agenda Fashion, início">
          <span className="brand-mark" aria-hidden="true">💅</span>
          <span>
            <strong>Agenda Fashion</strong>
            <small>Descubra e agende beleza</small>
          </span>
        </Link>

        <nav aria-label="Navegação principal">
          <NavLink
            className={({ isActive }) => isActive ? "text-link active" : "text-link"}
            end
            to="/"
          >
            Explorar
          </NavLink>
          <NavLink
            className={({ isActive }) => isActive ? "text-link active" : "text-link"}
            to="/minha-agenda"
          >
            Minha agenda
          </NavLink>
          {session.authenticated ? (
            <>
              <NavLink className="text-link" to={getWorkspacePath(session)}>
                {session.temNegocio ? "Área de trabalho" : "Criar negócio"}
              </NavLink>
              <button className="text-button" onClick={session.logout} type="button">
                Sair
              </button>
            </>
          ) : (
            <>
              <NavLink className="text-link" to="/cadastro">
                Sou profissional
              </NavLink>
              <NavLink className="button button-small" to="/entrar">
              Entrar
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
