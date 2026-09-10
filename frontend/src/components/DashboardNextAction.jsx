import { useEffect } from "react";
import { Link } from "react-router-dom";
import { track } from "../analytics/track";
import { PublicShareButton } from "./PublicShareButton";

const ACTIVATION_ROUTES = Object.freeze({
  agenda: { to: "/painel/agenda" },
  services: { to: "/painel/servicos" },
  firstService: { to: "/painel/servicos/novo?onboarding=servico" },
  business: { to: "/painel/negocio" },
});

const ALLOWED_NAVIGATION_DESTINATIONS = new Set(
  Object.values(ACTIVATION_ROUTES).map((item) => item.to)
);

const ACTIVATION_TRACKING_CONTEXT = Object.freeze({
  page: "dashboard_dono",
  mission: "gerenciar_crescimento",
});

function publicProfilePath(businessSlug) {
  const slug = String(businessSlug || "").trim();
  return slug ? `/negocio/${encodeURIComponent(slug)}` : "";
}

function fallbackNextAction() {
  return {
    estado: "INDISPONIVEL",
    concluido: false,
    titulo: "Continue configurando seu negócio",
    mensagem:
      "Não conseguimos calcular sua próxima etapa agora. Revise os dados do negócio para continuar.",
    acao: {
      tipo: "NAVEGAR",
      rotulo: "Revisar meu negócio",
      destino: ACTIVATION_ROUTES.business.to,
    },
  };
}

function normalizeAction(nextAction) {
  const source =
    nextAction && typeof nextAction === "object"
      ? nextAction
      : fallbackNextAction();
  const shareAction = source.acao?.tipo === "COMPARTILHAR_PERFIL";
  const requestedDestination =
    typeof source.acao?.destino === "string" ? source.acao.destino : "";
  const safeDestination = ALLOWED_NAVIGATION_DESTINATIONS.has(requestedDestination)
    ? requestedDestination
    : ACTIVATION_ROUTES.business.to;

  return {
    ...source,
    title:
      source.titulo ||
      (shareAction ? "Divulgue seu perfil" : "Continue configurando seu negócio"),
    description:
      source.mensagem ||
      "Continue a configuração do negócio para avançar na ativação.",
    kind: shareAction ? "share" : "navigate",
    primary: shareAction
      ? null
      : {
          label: source.acao?.rotulo || "Revisar meu negócio",
          to: safeDestination,
        },
  };
}

function activationTrackingProperties(action) {
  return {
    estado_ativacao:
      String(action.estado || "INDISPONIVEL"),
    tipo_acao:
      String(action.acao?.tipo || "NAVEGAR"),
  };
}

export function DashboardNextAction({
  nextAction,
  businessId,
  businessName,
  businessSlug,
}) {
  const action = normalizeAction(nextAction);
  const profilePath = publicProfilePath(businessSlug);
  const actionState = String(action.estado || "INDISPONIVEL");
  const actionType = String(action.acao?.tipo || "NAVEGAR");
  const activationCompleted =
    action.concluido === true ||
    actionState === "ATIVADO";

  useEffect(() => {
    if (activationCompleted) return;

    track(
      "proxima_acao_ativacao_visualizada",
      {
        ...ACTIVATION_TRACKING_CONTEXT,
        businessId,
        properties: {
          estado_ativacao: actionState,
          tipo_acao: actionType,
        },
      }
    );
  }, [
    actionState,
    actionType,
    activationCompleted,
    businessId,
  ]);

  function trackSelection() {
    track(
      "proxima_acao_ativacao_selecionada",
      {
        ...ACTIVATION_TRACKING_CONTEXT,
        businessId,
        properties:
          activationTrackingProperties(action),
      }
    );
  }

  if (activationCompleted) return null;

  return (
    <section className="panel dashboard-action-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Próximo passo</p>
          <h2>{action.title}</h2>
        </div>
      </div>

      <p className="muted dashboard-action-copy">{action.description}</p>

      <div className="quick-actions dashboard-quick-actions">
        {action.kind === "share" ? (
          <>
            <PublicShareButton
              businessId={businessId}
              businessName={businessName}
              businessSlug={businessSlug}
              className="button"
              label={action.acao?.rotulo || "Compartilhar perfil"}
              onIntent={trackSelection}
              trackingMission="gerenciar_crescimento"
              trackingPage="dashboard_dono"
            />

            {profilePath && (
              <Link className="button button-secondary" to={profilePath}>
                Ver perfil público
              </Link>
            )}
          </>
        ) : (
          <Link
            className="button"
            onClick={trackSelection}
            to={action.primary.to}
          >
            {action.primary.label}
          </Link>
        )}
      </div>
    </section>
  );
}
