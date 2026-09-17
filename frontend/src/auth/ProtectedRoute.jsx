import { Navigate, useLocation } from "react-router-dom";
import { LoadingState } from "../components/ScreenState";
import { useSession } from "./SessionContext";
import {
  getBusinessCreationPath,
  getOwnerContext,
  getPlanIntentPath,
  getProfessionalContext,
  normalizePlanSlug
} from "./session";

export function ProtectedRoute({
  children,
  ownerOnly = false,
  professionalOnly = false,
  businessRequired = false,
  publishedBusinessRequired = false,
  adminOnly = false
}) {
  const session = useSession();
  const location = useLocation();
  const ownerContext = getOwnerContext(session);
  const professionalContext = getProfessionalContext(session);

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

  if (ownerOnly && !ownerContext) {
    return (
      <Navigate
        replace
        to={professionalContext ? "/profissional/agenda" : "/criar-negocio"}
      />
    );
  }

  if (professionalOnly && !professionalContext) {
    return (
      <Navigate
        replace
        to={ownerContext ? "/painel" : "/convites"}
      />
    );
  }

  if (
    publishedBusinessRequired &&
    ownerContext?.publicado !== true
  ) {
    const planSlug = normalizePlanSlug(
      new URLSearchParams(location.search).get("plano")
    );

    return (
      <Navigate
        replace
        to={getPlanIntentPath("/painel", planSlug)}
      />
    );
  }

  return children;
}
