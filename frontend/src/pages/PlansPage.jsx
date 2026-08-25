import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { getBusinessWorkspacePath } from "../auth/session";
import { BackLink } from "../components/BackLink";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { formatCurrency } from "../utils/format";
import { planFeatures } from "../utils/plans";

function extractPlans(result) {
  return Array.isArray(result) ? result : result?.planos || [];
}

function planMatches(reference, plan, idKey, slugKey) {
  if (!reference || !plan) return false;
  return Number(reference[idKey]) === Number(plan.id)
    || reference[slugKey] === plan.slug;
}

export function PlansPage() {
  const session = useSession();
  const [plans, setPlans] = useState(null);
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await apiRequest("/planos");
      setPlans(extractPlans(result));
      if (session.authenticated && session.temNegocio) {
        try {
          setCurrent(await apiRequest("/meu-plano"));
        } catch (requestError) {
          if (requestError.status !== 404) throw requestError;
        }
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [session.authenticated, session.temNegocio]);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="container page-content plans-page">
      <BackLink to={session.authenticated && session.temNegocio ? "/painel/assinatura" : "/"}>
        {session.authenticated && session.temNegocio ? "Voltar ao plano e assinatura" : "Voltar ao início"}
      </BackLink>
      <header className="center-heading">
        <p className="eyebrow">Cresça no seu ritmo</p>
        <h1>Planos que acompanham seu sucesso</h1>
        <p>Comece com o necessário e evolua quando sua agenda pedir mais espaço.</p>
      </header>
      {!plans && !error && <LoadingState>Carregando planos...</LoadingState>}
      {!plans && error && <ErrorState message={error} onRetry={load} />}
      {plans && (
        <section className="plans-grid">
          {plans.map((plan) => {
            const paid = Number(plan.valor) > 0;
            const isCurrent = planMatches(current, plan, "plano_id", "plano_slug");
            const isAwaitingSubscription = paid
              && !isCurrent
              && session.negocio?.papel === "dono"
              && planMatches(
                current,
                plan,
                "plano_selecionado_id",
                "plano_selecionado_slug"
              );
            const professionalRegistration = new URLSearchParams({
              tipo: "profissional",
              ...(paid ? { plano: plan.slug } : {})
            });
            const target = !session.authenticated
              ? `/cadastro?${professionalRegistration}`
              : !session.temNegocio
                ? paid
                  ? `/criar-negocio?plano=${encodeURIComponent(plan.slug)}`
                  : "/criar-negocio"
                : session.negocio?.papel !== "dono"
                  ? getBusinessWorkspacePath(session)
                : paid
                  ? `/checkout?plano=${encodeURIComponent(plan.slug)}`
                  : "/painel";
            const cardClass = [
              "plan-card",
              plan.destaque ? "featured" : "",
              isCurrent ? "current" : "",
              isAwaitingSubscription ? "selected-pending" : ""
            ].filter(Boolean).join(" ");
            const actionLabel = isAwaitingSubscription
              ? `Assinar ${plan.nome}`
              : paid
                ? "Escolher plano"
                : "Começar grátis";

            return (
              <article className={cardClass} key={plan.id}>
                {plan.destaque && <span className="plan-highlight">Mais escolhido</span>}
                {isAwaitingSubscription && (
                  <span className="plan-selected-badge">Aguardando assinatura</span>
                )}
                <p className="eyebrow">{paid ? "Para crescer" : "Para começar"}</p>
                <h2>{plan.nome}</h2>
                <p className="plan-price"><strong>{formatCurrency(plan.valor)}</strong><span>/mês</span></p>
                <ul>{planFeatures(plan).map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
                {isCurrent ? (
                  <span aria-disabled="true" className="button button-current button-full">
                    ✓ Plano atual
                  </span>
                ) : (
                  <Link className="button button-full" to={target}>
                    {actionLabel}
                  </Link>
                )}
              </article>
            );
          })}
        </section>
      )}
      <section className="panel plans-commercial-details" aria-label="Condições dos planos">
        <h2>Condições claras antes de assinar</h2>
        <p>
          O plano Grátis não exige cartão. Planos pagos têm ciclo mensal, cobrança por PIX e não possuem taxa de adesão. Você pode cancelar a renovação na sua conta; o acesso pago continua até o fim do período já quitado.
        </p>
        <p>
          Consulte os <Link to="/termos">Termos de uso</Link>, a <Link to="/privacidade">Política de Privacidade</Link> ou fale com <a href="mailto:contato@agendafashion.com.br">contato@agendafashion.com.br</a>.
        </p>
      </section>
    </main>
  );
}
