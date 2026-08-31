import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { ConfirmationIcon } from "./ConfirmationIcon";
import { PublicShareButton } from "./PublicShareButton";

const SERVICE_PENDING = "pelo menos um serviço ativo";
const SCHEDULE_PENDING = "confirmar os horários de atendimento";

function normalizePending(publication) {
  return Array.isArray(publication?.pendencias)
    ? publication.pendencias
    : [];
}

export function buildOnboardingSteps({ publication, scheduleConfigured }) {
  const pending = normalizePending(publication);
  const scheduleBlocksPublication =
    pending.includes(SCHEDULE_PENDING);
  const profilePending = pending.filter(
    (item) => ![
      SERVICE_PENDING,
      SCHEDULE_PENDING
    ].includes(item)
  );
  const steps = [
    {
      id: "perfil",
      title: "Complete seu perfil",
      description: profilePending.length > 0
        ? `Falta: ${profilePending.join(", ")}.`
        : "Nome, contato e localização estão prontos.",
      complete: profilePending.length === 0,
      to: "/painel/negocio",
      action: "Completar perfil"
    },
    {
      id: "servico",
      title: "Cadastre um serviço",
      description: pending.includes(SERVICE_PENDING)
        ? "Informe o serviço, o valor e a duração."
        : "Seu primeiro serviço está disponível.",
      complete: !pending.includes(SERVICE_PENDING),
      to: "/painel/servicos/novo",
      action: "Cadastrar serviço"
    }
  ];

  const publicationStep = {
    id: "publicacao",
    title: "Publicação automática",
    description: publication?.publicado
      ? "Seu perfil já pode ser encontrado por clientes."
      : scheduleBlocksPublication
        ? "Publicamos depois que perfil, serviço e horários estiverem confirmados."
        : "Com os dados essenciais e um serviço, publicamos seu negócio.",
    complete: publication?.publicado === true,
    to: "/painel/negocio",
    action: "Verificar publicação"
  };

  if (scheduleConfigured !== undefined) {
    const statusConhecido = typeof scheduleConfigured === "boolean";
    const scheduleStep = {
      id: "agenda",
      title: "Configure seus horários",
      description: scheduleConfigured === true
        ? "Seus horários estão prontos para receber agendamentos."
        : scheduleConfigured === false
          ? scheduleBlocksPublication
            ? "Confirme quando clientes podem agendar. Essa etapa libera a publicação."
            : publication?.publicado
              ? "Seu perfil está no ar. Agora escolha quando clientes podem agendar."
              : "Depois da publicação, defina quando clientes podem agendar."
          : "Não conseguimos confirmar seus horários agora. Abra a configuração para conferir.",
      complete: scheduleConfigured === true,
      to: "/painel/horarios",
      action: statusConhecido ? "Configurar horários" : "Verificar horários"
    };

    if (scheduleBlocksPublication) {
      steps.push(
        scheduleStep,
        publicationStep
      );
    } else {
      steps.push(
        publicationStep,
        scheduleStep
      );
    }
  } else {
    steps.push(publicationStep);
  }

  return steps;
}

export function ProfessionalOnboardingChecklist({
  businessId,
  businessSlug,
  loading,
  publication,
  scheduleConfigured: scheduleConfiguredProp
}) {
  const [scheduleState, setScheduleState] = useState(() => ({
    configured: typeof scheduleConfiguredProp === "boolean"
      ? scheduleConfiguredProp
      : null,
    loading: typeof scheduleConfiguredProp !== "boolean"
  }));

  useEffect(() => {
    if (typeof scheduleConfiguredProp === "boolean") {
      setScheduleState({
        configured: scheduleConfiguredProp,
        loading: false
      });
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    setScheduleState({ configured: null, loading: true });

    apiRequest("/agenda-configuracao/status", { signal: controller.signal })
      .then((result) => {
        if (!active) return;

        setScheduleState({
          configured: result.configurada === true,
          loading: false
        });
      })
      .catch((requestError) => {
        if (!active || requestError.name === "AbortError") return;

        setScheduleState({
          configured: null,
          loading: false
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [scheduleConfiguredProp]);

  if (!loading && !publication) return null;

  if (loading || scheduleState.loading) {
    return (
      <section className="panel onboarding-panel" aria-busy="true">
        <p className="eyebrow">Primeiros passos</p>
        <h2>Preparando seu caminho para receber clientes...</h2>
      </section>
    );
  }

  const steps = buildOnboardingSteps({
    publication,
    scheduleConfigured: scheduleState.configured
  });
  const completed = steps.filter((step) => step.complete).length;
  const nextStep = steps.find((step) => !step.complete);
  const progress = Math.round((completed / steps.length) * 100);

  if (!nextStep) {
    return (
      <section className="panel onboarding-panel is-complete">
        <div className="onboarding-complete-copy">
          <p className="eyebrow onboarding-complete-eyebrow">
            <ConfirmationIcon className="onboarding-complete-icon" />
            <span>Configuração concluída</span>
          </p>
          <h2>Sua agenda está pronta. Agora traga seu primeiro agendamento</h2>
          <p className="muted">
            Compartilhe seu perfil para levar clientes direto aos seus serviços e horários disponíveis.
          </p>
        </div>
        <div className="onboarding-complete-actions">
          <strong className="onboarding-progress-label">
            {completed} de {steps.length}
          </strong>
          {businessSlug && (
            <>
              <PublicShareButton
                businessId={businessId}
                businessSlug={businessSlug}
                className="button"
                label="Compartilhar perfil"
                trackingMission="gerenciar_crescimento"
                trackingPage="dashboard_dono"
              />
              <Link
                className="button button-secondary"
                to={`/negocio/${encodeURIComponent(businessSlug)}`}
              >
                Ver meu perfil público <span aria-hidden="true">↗</span>
              </Link>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="panel onboarding-panel">
      <div className="onboarding-heading">
        <div>
          <p className="eyebrow">Primeiros passos</p>
          <h2>
            Prepare seu negócio para receber agendamentos
          </h2>
          <p className="muted">
            Complete o perfil, cadastre um serviço e confirme seus horários. A publicação continua automática e gratuita.
          </p>
        </div>
        <strong className="onboarding-progress-label">
          {completed} de {steps.length}
        </strong>
      </div>

      <progress
        aria-label="Progresso da configuração do negócio"
        className="onboarding-progress"
        max="100"
        value={progress}
      >
        {progress}%
      </progress>

      <ol className="onboarding-steps">
        {steps.map((step, index) => (
          <li className={step.complete ? "is-complete" : ""} key={step.id}>
            <span className="onboarding-step-marker" aria-hidden="true">
              {step.complete ? "✓" : index + 1}
            </span>
            <div>
              <strong>{step.title}</strong>
              <small>{step.description}</small>
            </div>
          </li>
        ))}
      </ol>

      <div className="onboarding-actions">
        <Link
          className="button"
          state={{ onboarding: true, onboardingStep: nextStep.id }}
          to={nextStep.to}
        >
          {nextStep.action}
        </Link>
      </div>
    </section>
  );
}
