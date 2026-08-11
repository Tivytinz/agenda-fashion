import { Navigate, useLocation } from "react-router-dom";
import { LoadingState } from "../components/ScreenState";
import { useSession } from "./SessionContext";
import { getBusinessCreationPath, normalizePlanSlug } from "./session";

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
    const planSlug = businessRequired
      ? normalizePlanSlug(
          new URLSearchParams(location.search).get("plano")
        )
      : "";
    const loginPath = planSlug
      ? `/entrar?tipo=profissional&plano=${encodeURIComponent(planSlug)}`
      : "/entrar";

    return (
      <Navigate
        replace
        state={{ from: `${location.pathname}${location.search}` }}
        to={loginPath}
      />
    );
  }

  if (adminOnly && !session.ehAdministrador) {
    return <Navigate replace to="/" />;
  }

  if (businessRequired && !session.temNegocio) {
    const planSlug = normalizePlanSlug(
      new URLSearchParams(location.search).get("plano")
    );

    return (
      <Navigate
        replace
        state={{ from: `${location.pathname}${location.search}` }}
        to={getBusinessCreationPath(planSlug)}
      />
    );
  }

  if (ownerOnly && session.negocio?.papel !== "dono") {
    return <Navigate replace to="/profissional/agenda" />;
  }

  return children;
}
