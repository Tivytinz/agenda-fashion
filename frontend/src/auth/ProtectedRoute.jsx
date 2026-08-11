import { Navigate, useLocation } from "react-router-dom";
import { LoadingState } from "../components/ScreenState";
import { useSession } from "./SessionContext";

export function ProtectedRoute({
  children,
  ownerOnly = false,
  businessRequired = false,
  adminOnly = false
}) {
  const session = useSession();
  const location = useLocation();

  if (session.loading) {
    return (
      <main className="container page-content">
        <LoadingState>Carregando sua conta...</LoadingState>
      </main>
    );
  }

  if (!session.authenticated) {
    return (
      <Navigate
        replace
        state={{ from: `${location.pathname}${location.search}` }}
        to="/entrar"
      />
    );
  }

  if (adminOnly && !session.ehAdministrador) {
    return <Navigate replace to="/" />;
  }

  if (businessRequired && !session.temNegocio) {
    return <Navigate replace to="/criar-negocio" />;
  }

  if (ownerOnly && session.negocio?.papel !== "dono") {
    return <Navigate replace to="/profissional/agenda" />;
  }

  return children;
}
