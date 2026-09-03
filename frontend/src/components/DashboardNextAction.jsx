import { Link } from "react-router-dom";
import { PublicShareButton } from "./PublicShareButton";

const COPILOT_ROUTES = Object.freeze({
  agenda: {
    to: "/painel/agenda",
  },
  services: {
    to: "/painel/servicos",
  },
  schedule: {
    to: "/painel/horarios",
  },
  business: {
    to: "/painel/negocio",
  },
});

const ALLOWED_NAVIGATION_DESTINATIONS = new Set(
  Object.values(
    COPILOT_ROUTES
  ).map(
    (item) => item.to
  )
);

function publicProfilePath(
  businessSlug
) {
  const slug = String(
    businessSlug || ""
  ).trim();

  return slug
    ? `/negocio/${encodeURIComponent(slug)}`
    : "";
}

function fallbackCopilot() {
  return {
    estado: "INDISPONIVEL",
    concluido: false,
    titulo: "Continue configurando seu negócio",
    mensagem:
      "Não conseguimos calcular sua próxima etapa agora. Revise os dados do negócio para continuar.",
    acao: {
      tipo: "NAVEGAR",
      rotulo: "Revisar meu negócio",
      destino:
        COPILOT_ROUTES.business.to,
    },
  };
}

function normalizeAction(
  copilot
) {
  const source =
    copilot &&
    typeof copilot === "object"
      ? copilot
      : fallbackCopilot();
  const shareAction =
    source.acao?.tipo ===
      "COMPARTILHAR_PERFIL";
  const requestedDestination =
    typeof source.acao?.destino === "string"
      ? source.acao.destino
      : "";
  const safeDestination =
    ALLOWED_NAVIGATION_DESTINATIONS
      .has(requestedDestination)
      ? requestedDestination
      : COPILOT_ROUTES.business.to;

  return {
    ...source,
    title:
      source.titulo ||
      (shareAction
        ? "Divulgue seu perfil"
        : "Continue configurando seu negócio"),
    description:
      source.mensagem ||
      "Continue a configuração do negócio para avançar na ativação.",
    kind:
      shareAction
        ? "share"
        : "navigate",
    primary:
      shareAction
        ? null
        : {
            label:
              source.acao?.rotulo ||
              "Revisar meu negócio",
            to: safeDestination,
          },
  };
}

export function DashboardNextAction({
  copilot,
  businessId,
  businessName,
  businessSlug,
}) {
  const action =
    normalizeAction(
      copilot
    );
  const profilePath =
    publicProfilePath(
      businessSlug
    );

  return (
    <article
      className={`panel dashboard-action-panel${action.concluido === true ? " is-complete" : ""}`}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            🤖 Copilot AF
          </p>
          <h2>{action.title}</h2>
        </div>
      </div>

      <p className="muted dashboard-action-copy">
        {action.description}
      </p>

      <div className="quick-actions dashboard-quick-actions">
        {action.kind === "share" ? (
          <>
            <PublicShareButton
              businessId={businessId}
              businessName={businessName}
              businessSlug={businessSlug}
              className="button"
              label={action.acao?.rotulo || "Compartilhar perfil"}
              trackingMission="gerenciar_crescimento"
              trackingPage="dashboard_dono"
            />

            {profilePath && (
              <Link
                className="button button-secondary"
                to={profilePath}
              >
                Ver perfil público
              </Link>
            )}
          </>
        ) : (
          <Link
            className="button"
            to={action.primary.to}
          >
            {action.primary.label}
          </Link>
        )}
      </div>
    </article>
  );
}
