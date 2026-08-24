import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { formatCurrency, formatDate } from "../utils/format";

const ACTIVE_STATUSES = new Set(["ACTIVE"]);
const PENDING_STATUSES = new Set(["PENDING", "PENDING_PAYMENT"]);
const CANCELED_STATUSES = new Set(["CANCELED", "CANCELLED"]);
const INACTIVE_STATUSES = new Set(["INACTIVE", "DELETED", "OVERDUE", "PAST_DUE"]);

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function subscriptionStatus(plan, subscription) {
  if (Number(plan?.valor) === 0) {
    return { label: "Plano gratuito", tone: "success", active: true };
  }

  if (!subscription) {
    return { label: "Sem assinatura ativa", tone: "neutral", active: false };
  }

  const status = normalizeStatus(subscription.status);

  if (ACTIVE_STATUSES.has(status) || (subscription.ativo === true && !CANCELED_STATUSES.has(status))) {
    return { label: "Assinatura ativa", tone: "success", active: true };
  }

  if (PENDING_STATUSES.has(status)) {
    return { label: "Pagamento pendente", tone: "warning", active: false };
  }

  if (CANCELED_STATUSES.has(status)) {
    return { label: "Renovação cancelada", tone: "warning", active: subscription.ativo === true };
  }

  if (INACTIVE_STATUSES.has(status)) {
    return { label: "Assinatura inativa", tone: "danger", active: false };
  }

  return {
    label: status ? status.replaceAll("_", " ") : "Sem assinatura ativa",
    tone: "neutral",
    active: subscription.ativo === true
  };
}

function formatPaymentMethod(value) {
  const method = String(value || "").trim().toUpperCase();
  if (!method) return "Não informada";
  if (method === "PIX") return "PIX";
  if (["CARTAO", "CARTÃO", "CREDIT_CARD"].includes(method)) return "Cartão";
  if (method === "BOLETO") return "Boleto";
  return value;
}

function finiteLimit(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function remainingLabel(usedValue, limitValue) {
  const used = Math.max(0, Number(usedValue) || 0);
  const limit = finiteLimit(limitValue);
  if (limit === null) return "Sem limite";
  const remaining = Math.max(0, limit - used);
  if (remaining === 0) return "Limite atingido";
  return `${remaining} ${remaining === 1 ? "disponível" : "disponíveis"}`;
}

function usageValue(usedValue, limitValue) {
  const used = Math.max(0, Number(usedValue) || 0);
  const limit = finiteLimit(limitValue);
  return `${used} / ${limit === null ? "∞" : limit}`;
}

function appointmentSummary(usedValue, limitValue) {
  const used = Math.max(0, Number(usedValue) || 0);
  const limit = finiteLimit(limitValue);
  if (limit === null) return `${used} agendamentos · sem limite`;
  const remaining = Math.max(0, limit - used);
  return `${used} de ${limit} agendamentos · ${remaining} ${remaining === 1 ? "disponível" : "disponíveis"}`;
}

function progressPercent(usedValue, limitValue, backendPercent) {
  const backend = Number(backendPercent);
  if (Number.isFinite(backend)) return Math.max(0, Math.min(100, backend));

  const used = Math.max(0, Number(usedValue) || 0);
  const limit = finiteLimit(limitValue);
  if (limit === null || limit <= 0) return 0;
  return Math.max(0, Math.min(100, (used / limit) * 100));
}

function paymentStatus(value) {
  const status = normalizeStatus(value);
  if (["CONFIRMED", "RECEIVED", "PAID"].includes(status)) return { label: "Pago", tone: "success" };
  if (["PENDING", "AWAITING_PAYMENT"].includes(status)) return { label: "Pendente", tone: "warning" };
  if (["OVERDUE", "PAST_DUE"].includes(status)) return { label: "Atrasado", tone: "danger" };
  if (["REFUNDED", "REFUND_REQUESTED"].includes(status)) return { label: "Reembolsado", tone: "neutral" };
  if (["CANCELED", "CANCELLED", "DELETED"].includes(status)) return { label: "Cancelado", tone: "neutral" };
  return { label: status ? status.replaceAll("_", " ") : "Não informado", tone: "neutral" };
}

export function SubscriptionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(() =>
    location.state?.payment === "confirmed"
      ? "Pagamento confirmado. Seu plano foi atualizado."
      : ""
  );
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const load = useCallback(() => {
    setError("");
    apiRequest("/minha-assinatura")
      .then(setData)
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (location.state?.payment) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  async function cancel() {
    setCanceling(true);
    setCancelError("");
    try {
      const result = await apiRequest("/minha-assinatura", { method: "DELETE" });
      setMessage(result.mensagem);
      dialogRef.current?.close();
      load();
    } catch (requestError) {
      setCancelError(requestError.message);
    } finally {
      setCanceling(false);
    }
  }

  if (!data && !error) {
    return <div className="workspace-page"><LoadingState>Carregando assinatura...</LoadingState></div>;
  }
  if (!data && error) {
    return <div className="workspace-page"><ErrorState message={error} onRetry={load} /></div>;
  }

  const plan = data.plano || {};
  const subscription = data.assinatura || null;
  const usage = data.uso || {};
  const payments = Array.isArray(data.pagamentos) ? data.pagamentos : [];
  const state = subscriptionStatus(plan, subscription);
  const isFree = Number(plan.valor) === 0;
  const needsSubscription = !isFree && !subscription;
  const rawStatus = normalizeStatus(subscription?.status);
  const canCancel = ACTIVE_STATUSES.has(rawStatus) && subscription?.ativo !== false;
  const planSlug = String(plan.slug || "").trim();
  const checkoutTarget = planSlug
    ? `/checkout?plano=${encodeURIComponent(planSlug)}`
    : "/planos";
  const appointmentsPercent = progressPercent(
    usage.utilizados,
    usage.limite,
    usage.percentual
  );

  return (
    <main className="workspace-page subscription-settings-page">
      <header className="workspace-heading subscription-heading">
        <div>
          <p className="eyebrow">Seu crescimento continua</p>
          <h1>Plano e assinatura</h1>
          <p>Acompanhe uso, pagamentos e a próxima renovação.</p>
        </div>
        <Link className="button button-secondary" to="/planos">
          {needsSubscription ? "Escolher plano" : "Ver planos"}
        </Link>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}

      <section className="billing-grid subscription-overview-grid">
        <article className="panel subscription-card subscription-plan-card">
          <div className="panel-heading subscription-plan-heading">
            <div>
              <p className="eyebrow">{needsSubscription ? "Plano disponível" : "Plano atual"}</p>
              <h2>{plan.nome || "Plano grátis"}</h2>
            </div>
            <span className={`subscription-state-badge is-${state.tone}`}>{state.label}</span>
          </div>

          <strong className="subscription-price">
            {formatCurrency(plan.valor)}<small>/mês</small>
          </strong>

          {subscription ? (
            <dl className="data-list subscription-data-list">
              <div>
                <dt>Forma de pagamento</dt>
                <dd>{formatPaymentMethod(subscription.forma_pagamento)}</dd>
              </div>
              <div>
                <dt>Próxima cobrança</dt>
                <dd>
                  {subscription.data_proxima_cobranca
                    ? formatDate(subscription.data_proxima_cobranca)
                    : state.active
                      ? "Aguardando definição"
                      : "Nenhuma cobrança agendada"}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="subscription-no-billing">
              <p>
                {isFree
                  ? "Seu plano gratuito não possui cobrança mensal."
                  : "Este plano ainda não possui uma assinatura ativa nem cobrança agendada."}
              </p>
              {needsSubscription && (
                <Link className="button subscription-primary-action" to={checkoutTarget}>
                  {plan.nome ? `Assinar ${plan.nome}` : "Assinar plano"}
                </Link>
              )}
            </div>
          )}

          {canCancel && (
            <button
              className="text-button danger-text subscription-cancel-action"
              onClick={() => {
                setCancelError("");
                dialogRef.current?.showModal();
              }}
              type="button"
            >
              Cancelar renovação
            </button>
          )}
        </article>

        <article className="panel billing-usage-card">
          <p className="eyebrow">Uso neste mês</p>
          <h2>Seus limites atuais</h2>
          <p className="muted billing-usage-intro">
            {needsSubscription
              ? "Enquanto a assinatura não estiver ativa, valem os limites gratuitos."
              : "Acompanhe o que já foi usado e o que ainda está disponível."}
          </p>

          <div className="usage-item subscription-usage-primary">
            <span>{appointmentSummary(usage.utilizados, usage.limite)}</span>
            <progress aria-label="Uso de agendamentos" max="100" value={appointmentsPercent} />
          </div>

          <dl className="data-list usage-data-list">
            <div>
              <dt>Profissionais</dt>
              <dd>
                <strong>{usageValue(usage.profissionais_utilizados, usage.limite_profissionais)}</strong>
                <small className={remainingLabel(usage.profissionais_utilizados, usage.limite_profissionais) === "Limite atingido" ? "usage-limit-note is-reached" : "usage-limit-note"}>
                  {remainingLabel(usage.profissionais_utilizados, usage.limite_profissionais)}
                </small>
              </dd>
            </div>
            <div>
              <dt>Serviços</dt>
              <dd>
                <strong>{usageValue(usage.servicos_utilizados, usage.limite_servicos)}</strong>
                <small className={remainingLabel(usage.servicos_utilizados, usage.limite_servicos) === "Limite atingido" ? "usage-limit-note is-reached" : "usage-limit-note"}>
                  {remainingLabel(usage.servicos_utilizados, usage.limite_servicos)}
                </small>
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section className={`panel billing-payments-panel ${payments.length ? "" : "is-empty"}`}>
        <div className="panel-heading"><h2>Pagamentos</h2></div>
        {!payments.length ? (
          <div className="billing-empty-state">
            <div>
              <strong>Nenhum pagamento registrado ainda.</strong>
              <p>
                {isFree
                  ? "O plano gratuito não gera cobranças."
                  : "Seus pagamentos aparecerão aqui após a primeira cobrança."}
              </p>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Data</th><th>Valor</th><th>Forma</th><th>Status</th></tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const paymentState = paymentStatus(payment.status);
                  return (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.data_pagamento || payment.data_vencimento)}</td>
                      <td>{formatCurrency(payment.valor)}</td>
                      <td>{formatPaymentMethod(payment.forma_pagamento)}</td>
                      <td>
                        <span className={`payment-state-badge is-${paymentState.tone}`}>
                          {paymentState.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <dialog
        aria-labelledby="cancel-subscription-title"
        className="cancel-dialog"
        onCancel={(event) => {
          if (canceling) event.preventDefault();
        }}
        ref={dialogRef}
      >
        <div className="cancel-dialog-content">
          <div aria-hidden="true" className="cancel-dialog-icon">!</div>
          <h2 id="cancel-subscription-title">Cancelar renovação?</h2>
          <p>Seu acesso continua até o fim do período que já foi pago.</p>
          {cancelError && <p className="form-error" role="alert">{cancelError}</p>}
          <div className="cancel-dialog-actions">
            <button
              className="button button-secondary"
              disabled={canceling}
              onClick={() => {
                setCancelError("");
                dialogRef.current?.close();
              }}
              type="button"
            >
              Manter plano
            </button>
            <button className="button button-danger" disabled={canceling} onClick={cancel} type="button">
              {canceling ? "Cancelando..." : "Sim, cancelar"}
            </button>
          </div>
        </div>
      </dialog>
    </main>
  );
}