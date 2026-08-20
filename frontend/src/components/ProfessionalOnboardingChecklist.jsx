import { Link } from "react-router-dom";

const SERVICE_PENDING = "pelo menos um serviço ativo";

function normalizePending(publication) {
  return Array.isArray(publication?.pendencias)
    ? publication.pendencias
    : [];
}

export function buildOnboardingSteps({ publication }) {
  const pending = normalizePending(publication);
  const profilePending = pending.filter((item) => item !== SERVICE_PENDING);

  return [
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
    },
    {
      id: "publicacao",
      title: "Publicação automática",
      description: publication?.publicado
        ? "Seu perfil já pode ser encontrado por clientes."
        : "Ao concluir o perfil e o serviço, publicamos seu negócio.",
      complete: publication?.publicado === true,
      to: "/painel/negocio",
      action: "Verificar publicação"
    }
  ];
}

export function ProfessionalOnboardingChecklist({
  businessSlug,
  loading,
  publication
}) {
  if (!loading && !publication) return null;

  if (loading) {
    return (
      <section className="panel onboarding-panel" aria-busy="true">
        <p className="eyebrow">Primeiros passos</p>
        <h2>Preparando seu caminho para receber clientes...</h2>
      </section>
    );
  }

  const steps = buildOnboardingSteps({ publication });
  const completed = steps.filter((step) => step.complete).length;
  const nextStep = steps.find((step) => !step.complete);
  const progress = Math.round((completed / steps.length) * 100);

  if (!nextStep) {
    return (
      <section className="panel onboarding-panel is-complete">
        <div className="onboarding-heading">
          <div>
            <p className="eyebrow">Configuração concluída</p>
            <h2>Seu negócio está pronto para crescer</h2>
            <p className="muted">
              Compartilhe seu perfil e mantenha serviços e horários atualizados.
            </p>
          </div>
          <strong className="onboarding-progress-label">3 de 3</strong>
        </div>
        {businessSlug && (
          <div className="onboarding-actions">
            <Link
              className="button"
              to={`/negocio/${encodeURIComponent(businessSlug)}`}
            >
              Ver meu perfil público
            </Link>
          </div>
        )}
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
            Complete o perfil e cadastre um serviço. A publicação é automática e gratuita.
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
