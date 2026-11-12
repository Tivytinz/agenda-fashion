import { Link } from "react-router-dom";
import { getPlanIntentPath } from "../auth/session";
import { formatWhatsApp } from "../utils/format";
import { clearBusinessCreationDraft } from "../features/business/draft";
import { SetupFlowFrame, SetupTitle } from "./SetupFlowFrame";

// A conta já foi criada. Reabrir o formulário de registro faria a pessoa
// tentar cadastrar outra conta; a etapa concluída mostra apenas dados da sessão.
export function ProfessionalSignupReview({ user, planSlug = "" }) {
  const nextStep = getPlanIntentPath("/criar-negocio", planSlug);
  return (
    <SetupFlowFrame onExit={clearBusinessCreationDraft} step={1}>
      <main className="auth-page">
        <section aria-labelledby="professional-review-title" className="auth-card auth-card-professional-register">
          <SetupTitle emoji="💖" id="professional-review-title">Sua conta</SetupTitle>
          <p className="muted">Etapa 1 concluída. Confira seus dados antes de continuar com o negócio.</p>
          <dl className="professional-signup-review">
            <div><dt>Nome completo</dt><dd>{user.nome || "Não informado"}</dd></div>
            <div><dt>E-mail</dt><dd>{user.email || "Não informado"}</dd></div>
            <div><dt>WhatsApp com DDD</dt><dd>{formatWhatsApp(user.whatsapp) || "Não informado"}</dd></div>
          </dl>
          <div className="professional-signup-review-actions">
            <Link className="button button-full" to={nextStep}>Continuar para o negócio</Link>
            <Link className="button button-secondary button-full" state={{ fromProfessionalSignupReview: true, planSlug }} to="/conta">Editar meus dados</Link>
          </div>
          <small className="professional-signup-review-note">Sua conta já existe. Não é necessário cadastrar e-mail ou senha novamente.</small>
        </section>
      </main>
    </SetupFlowFrame>
  );
}
