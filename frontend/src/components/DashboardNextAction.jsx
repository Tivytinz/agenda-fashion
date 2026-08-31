import { Link } from "react-router-dom";
import { PublicShareButton } from "./PublicShareButton";

const SCHEDULE_PENDING =
  "confirmar os horários de atendimento";

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

function scheduleAction({
  publishesProfile = false,
} = {}) {
  return {
    kind: "schedule",
    title: publishesProfile
      ? "Confirme horários para publicar"
      : "Deixe a agenda pronta",
    description:
      publishesProfile
        ? "Este é o último passo: confirme quando você atende para publicar o perfil e liberar agendamentos online."
        : "Confirme seus horários para liberar horários reais no perfil e permitir agendamentos online.",
    primary: {
      label: "Configurar horários",
      to: "/painel/horarios",
    },
    secondary: {
      label: "Gerenciar serviços",
      to: "/painel/servicos",
    },
  };
}

function conversionAction(
  profileVisits
) {
  return {
    kind: "conversion",
    title:
      "Transforme visitas em agendamentos",
    description:
      `${profileVisits} pessoas visitaram seu perfil, mas seu primeiro agendamento ainda não chegou. Revise serviços, preços e horários.`,
    primary: {
      label: "Gerenciar serviços",
      to: "/painel/servicos",
    },
    secondary: {
      label: "Revisar horários",
      to: "/painel/horarios",
    },
  };
}

function resolveNextAction({
  activation,
  publication,
  profileVisits,
}) {
  if (!activation) {
    return profileVisits >= 5
      ? conversionAction(
          profileVisits
        )
      : scheduleAction();
  }

  const published =
    activation.negocio_publicado === true;
  const scheduleConfigured =
    activation.agenda_configurada === true;
  const firstBookingReceived =
    activation.primeiro_agendamento_recebido === true;
  const publicationPending =
    Array.isArray(publication?.pendencias)
      ? publication.pendencias
      : [];
  const onlySchedulePending =
    !published &&
    !scheduleConfigured &&
    publicationPending.length > 0 &&
    publicationPending.every(
      (item) => item === SCHEDULE_PENDING
    );

  if (!published) {
    if (onlySchedulePending) {
      return scheduleAction({
        publishesProfile: true,
      });
    }

    return {
      kind: "profile",
      title:
        "Finalize seu perfil para aparecer",
      description:
        "Complete os dados essenciais do negócio e mantenha pelo menos um serviço ativo para liberar o perfil público.",
      primary: {
        label: "Revisar meu negócio",
        to: "/painel/negocio",
      },
      secondary: {
        label: "Gerenciar serviços",
        to: "/painel/servicos",
      },
    };
  }

  if (!scheduleConfigured) {
    return scheduleAction();
  }

  if (firstBookingReceived) {
    return {
      kind: "retention",
      title: "Mantenha o ritmo",
      description:
        "Seu negócio já recebeu o primeiro agendamento. Mantenha serviços e horários atualizados para transformar novas visitas em recorrência.",
      primary: {
        label: "Abrir agenda",
        to: "/painel/agenda",
      },
      secondary: {
        label: "Gerenciar serviços",
        to: "/painel/servicos",
      },
    };
  }

  if (profileVisits >= 5) {
    return conversionAction(
      profileVisits
    );
  }

  return {
    kind: "share",
    title: "Divulgue seu perfil",
    description:
      "Sua agenda está pronta e seu perfil está no ar. Compartilhe seu link para trazer visitas e conquistar o primeiro agendamento.",
  };
}

export function DashboardNextAction({
  activation,
  businessId,
  businessName,
  businessSlug,
  publication,
  profileVisits = 0,
}) {
  const action = resolveNextAction({
    activation,
    publication,
    profileVisits:
      Number(profileVisits) || 0,
  });

  const profilePath =
    publicProfilePath(
      businessSlug
    );

  return (
    <article
      className="panel dashboard-action-panel"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            Próxima ação
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
              label="Compartilhar perfil"
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
          <>
            <Link
              className="button"
              to={action.primary.to}
            >
              {action.primary.label}
            </Link>
            <Link
              className="button button-secondary"
              to={action.secondary.to}
            >
              {action.secondary.label}
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
