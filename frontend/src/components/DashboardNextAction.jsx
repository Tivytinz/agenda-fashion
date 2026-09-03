import { Link } from "react-router-dom";
import { PublicShareButton } from "./PublicShareButton";

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
      destino: "/painel/negocio",
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
    copilot &&
    typeof copilot === "object"
      ? copilot
      : fallbackCopilot();
  const profilePath =
    publicProfilePath(
      businessSlug
    );
  const shareAction =
    action.acao?.tipo ===
      "COMPARTILHAR_PERFIL";
  const navigationAction =
    action.acao?.tipo === "NAVEGAR" &&
    typeof action.acao?.destino === "string" &&
    action.acao.destino.length > 0;

  return (
    <article
      className={`panel dashboard-action-panel${action.concluido === true ? " is-complete" : ""}`}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            🤖 Copilot AF
          </p>
          <h2>{action.titulo}</h2>
        </div>
      </div>

      <p className="muted dashboard-action-copy">
        {action.mensagem}
      </p>

      <div className="quick-actions dashboard-quick-actions">
        {shareAction && (
          <>
            <PublicShareButton
              businessId={businessId}
              businessName={businessName}
              businessSlug={businessSlug}
              className="button"
              label={action.acao.rotulo || "Compartilhar perfil"}
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
        )}

        {!shareAction && navigationAction && (
          <Link
            className="button"
            to={action.acao.destino}
          >
            {action.acao.rotulo}
          </Link>
        )}
      </div>
    </article>
  );
}
