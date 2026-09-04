import { useEffect } from "react";
import { Link } from "react-router-dom";
import { track } from "../analytics/track";
import { PublicShareButton } from "./PublicShareButton";

const ACTIVATION_ROUTES = Object.freeze({
  agenda: { to: "/painel/agenda" },
  services: { to: "/painel/servicos" },
  schedule: { to: "/painel/horarios" },
  business: { to: "/painel/negocio" },
});

const ALLOWED_NAVIGATION_DESTINATIONS = new Set(
  Object.values(ACTIVATION_ROUTES).map((item) => item.to)
);

const ACTIVATION_STEP_KEYS = Object.freeze([
  "possui_servico_ativo",
  "agenda_configurada",
  "negocio_publicado",
  "primeiro_agendamento_recebido",
]);

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

function activationProgress(activation) {
  if (!activation || typeof activation !== "object") return null;

  return ACTIVATION_STEP_KEYS.reduce(
    (total, key) => total + (activation[key] === true ? 1 : 0),
    0
  );
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
  activation,
  businessId,
  businessName,
  businessSlug,
}) {
  const action = normalizeAction(nextAction);
  const profilePath = publicProfilePath(businessSlug);
  const completedSteps = activationProgress(activation);
  const actionState = String(action.estado || "INDISPONIVEL");
  const actionType = String(action.acao?.tipo || "NAVEGAR");

  useEffect(() => {
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
  }, [actionState, actionType, businessId]);

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

  return (
    <section
      className={`panel dashboard-action-panel${action.concluido === true ? " is-complete" : ""}`}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Próximo passo</p>
          <h2>{action.title}</h2>
        </div>
      </div>

      <p className="muted dashboard-action-copy">{action.description}</p>

      {completedSteps !== null && (
        <p
          aria-label="Progresso da ativação"
          className="muted dashboard-action-progress"
        >
          {completedSteps} de 4 etapas concluídas
        </p>
      )}

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
