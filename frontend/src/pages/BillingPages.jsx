import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useSession } from "../auth/SessionContext";
import { BackLink } from "../components/BackLink";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import { formatCurrency, formatDate } from "../utils/format";
import { planFeatures } from "../utils/plans";

function extractPlans(result) {
  return Array.isArray(result) ? result : result?.planos || [];
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
        {session.authenticated && session.temNegocio ? "Voltar ao plano e assinatura" : "Voltar a explorar"}
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
            const isCurrent = Number(current?.plano_id ?? current?.id) === Number(plan.id)
              || current?.plano_slug === plan.slug;
            const paid = Number(plan.valor) > 0;
            const target = !session.authenticated
              ? "/cadastro"
              : !session.temNegocio
                ? "/criar-negocio"
                : paid
                  ? `/checkout?plano=${encodeURIComponent(plan.slug)}`
                  : "/painel";
            const cardClass = [
              "plan-card",
              plan.destaque ? "featured" : "",
              isCurrent ? "current" : ""
            ].filter(Boolean).join(" ");
            return (
              <article className={cardClass} key={plan.id}>
                {plan.destaque && <span className="plan-highlight">Mais escolhido</span>}
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
                    {paid ? "Escolher plano" : "Começar grátis"}
                  </Link>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
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
    setError("");
    try {
      const result = await apiRequest("/minha-assinatura", { method: "DELETE" });
      setMessage(result.mensagem);
      dialogRef.current?.close();
      load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCanceling(false);
    }
  }

  if (!data && !error) return <div className="workspace-page"><LoadingState>Carregando assinatura...</LoadingState></div>;
  if (!data && error) return <div className="workspace-page"><ErrorState message={error} onRetry={load} /></div>;

  const plan = data.plano || {};
  const subscription = data.assinatura;
  const usage = data.uso || {};
  const status = String(subscription?.status || (Number(plan.valor) === 0 ? "GRATUITO" : "SEM ASSINATURA")).toUpperCase();

  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <div><p className="eyebrow">Seu crescimento continua</p><h1>Plano e assinatura</h1><p>Acompanhe uso, pagamentos e a próxima renovação.</p></div>
        <Link className="button button-secondary" to="/planos">Ver planos</Link>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <section className="billing-grid">
        <article className="panel subscription-card">
          <div className="panel-heading"><div><p className="eyebrow">Plano atual</p><h2>{plan.nome || "Plano grátis"}</h2></div><span className="status-badge status-agendado">{status}</span></div>
          <strong className="subscription-price">{formatCurrency(plan.valor)}<small>/mês</small></strong>
          <dl className="data-list">
            <div><dt>Forma de pagamento</dt><dd>{subscription?.forma_pagamento || "—"}</dd></div>
            <div><dt>Próxima cobrança</dt><dd>{subscription?.data_proxima_cobranca ? formatDate(subscription.data_proxima_cobranca) : "—"}</dd></div>
          </dl>
          {status === "ACTIVE" && (
            <button className="text-button danger-text" onClick={() => dialogRef.current?.showModal()} type="button">Cancelar renovação</button>
          )}
        </article>
        <article className="panel">
          <p className="eyebrow">Uso neste mês</p><h2>O limite é o seu sucesso crescendo</h2>
          <div className="usage-item">
            <span><strong>{usage.utilizados || 0}</strong> de {usage.limite ?? "∞"} agendamentos</span>
            <progress max="100" value={usage.percentual || 0} />
          </div>
          <dl className="data-list">
            <div><dt>Profissionais</dt><dd>{usage.profissionais_utilizados || 0} / {usage.limite_profissionais ?? "∞"}</dd></div>
            <div><dt>Serviços</dt><dd>{usage.servicos_utilizados || 0} / {usage.limite_servicos ?? "∞"}</dd></div>
          </dl>
        </article>
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>Pagamentos</h2></div>
        {!data.pagamentos?.length ? <p className="muted">Nenhum pagamento registrado.</p> : (
          <div className="table-wrap"><table><thead><tr><th>Data</th><th>Valor</th><th>Forma</th><th>Status</th></tr></thead><tbody>
            {data.pagamentos.map((payment) => (
              <tr key={payment.id}><td>{formatDate(payment.data_pagamento || payment.data_vencimento)}</td><td>{formatCurrency(payment.valor)}</td><td>{payment.forma_pagamento}</td><td>{payment.status}</td></tr>
            ))}
          </tbody></table></div>
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
          <div className="cancel-dialog-actions">
            <button className="button button-secondary" disabled={canceling} onClick={() => dialogRef.current?.close()} type="button">Manter plano</button>
            <button className="button button-danger" disabled={canceling} onClick={cancel} type="button">{canceling ? "Cancelando..." : "Sim, cancelar"}</button>
          </div>
        </div>
      </dialog>
    </main>
  );
}

function paymentId(result) {
  return result?.pagamento?.id || result?.pagamento?.payment_id || result?.assinatura?.ultimo_pagamento_id || null;
}

function paymentConfirmed(result) {
  const status = String(result?.status || result?.pagamento?.status || result?.assinatura?.status || "").toUpperCase();
  return ["CONFIRMED", "RECEIVED", "ACTIVE"].includes(status);
}

export function BillingCheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const slug = searchParams.get("plano") || "";
  const [plan, setPlan] = useState(null);
  const [samePlan, setSamePlan] = useState(false);
  const [document, setDocument] = useState("");
  const [pix, setPix] = useState(null);
  const [checkoutPaymentId, setCheckoutPaymentId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("idle");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const pollRunRef = useRef(0);

  useEffect(() => () => {
    pollRunRef.current += 1;
  }, []);

  useEffect(() => {
    Promise.all([
      apiRequest("/planos"),
      apiRequest("/meu-plano").catch((requestError) => {
        if (requestError.status === 404) return null;
        throw requestError;
      })
    ])
      .then(([result, current]) => {
        const selected = extractPlans(result).find((item) => item.slug === slug);
        if (!selected) throw new Error("Plano não encontrado.");
        setPlan(selected);
        setSamePlan(
          Number(current?.plano_id ?? current?.id) === Number(selected.id)
          || current?.plano_slug === selected.slug
        );
      })
      .catch((requestError) => setError(requestError.message));
  }, [slug]);

  async function poll(id, checkImmediately = false) {
    if (!id) return;

    const run = pollRunRef.current + 1;
    pollRunRef.current = run;
    setPaymentStatus("checking");
    setPaymentMessage("Aguardando a confirmação automática do pagamento...");

    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (!checkImmediately || attempt > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
      }
      if (pollRunRef.current !== run) return;

      try {
        const status = await apiRequest(`/checkout/status/${encodeURIComponent(id)}`);
        if (pollRunRef.current !== run) return;
        if (paymentConfirmed(status)) {
          navigate("/painel/assinatura", { replace: true, state: { payment: "confirmed" } });
          return;
        }
      } catch {
        if (pollRunRef.current !== run) return;
        setPaymentStatus("error");
        setPaymentMessage("Não foi possível verificar o pagamento agora. Seu PIX continua válido.");
        return;
      }
    }

    if (pollRunRef.current === run) {
      setPaymentStatus("timeout");
      setPaymentMessage("Ainda não recebemos a confirmação. Se você já pagou, verifique novamente.");
    }
  }

  async function copyPixCode() {
    setCopyMessage("");
    try {
      await navigator.clipboard.writeText(pix.code);
      setCopyMessage("Código PIX copiado.");
    } catch {
      setCopyMessage("Não foi possível copiar automaticamente. Selecione o código acima e copie.");
    }
  }

  async function submit(event) {
    event.preventDefault();
    setProcessing(true);
    setError("");
    try {
      const result = await apiRequest("/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}` },
        body: {
          plano_id: plan.id,
          plano_slug: plan.slug,
          forma_pagamento: "pix",
          cpf_cnpj: document.replace(/\D/g, "")
        }
      });
      if (paymentConfirmed(result)) {
        navigate("/painel/assinatura", { replace: true, state: { payment: "confirmed" } });
        return;
      }
      const value = result.pix || result.pagamento?.pix || {};
      const id = paymentId(result);
      setPix({
        image: value.encodedImage || value.encoded_image || "",
        code: value.payload || value.copia_cola || ""
      });
      setCheckoutPaymentId(id || "");
      if (id) {
        void poll(id);
      } else {
        setPaymentStatus("error");
        setPaymentMessage("O PIX foi gerado, mas a confirmação automática não pôde ser iniciada.");
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProcessing(false);
    }
  }

  if (!plan && !error) return <main className="container page-content narrow-page"><LoadingState>Preparando checkout seguro...</LoadingState></main>;
  if (!plan && error) return <main className="container page-content narrow-page"><ErrorState message={error} /></main>;
  if (samePlan) {
    return (
      <main className="container page-content narrow-page">
        <section className="panel checkout-blocked">
          <p className="eyebrow">Plano atual</p>
          <h1>Você já possui o plano {plan.nome}</h1>
          <p>Não é necessário pagar novamente. Escolha outro plano somente quando quiser mudar os limites da sua agenda.</p>
          <Link className="button" to="/planos">Voltar aos planos</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="container page-content checkout-page">
      <Link className="back-link" to="/planos">← Voltar aos planos</Link>
      <div className="checkout-grid">
        <form className="panel stack-form" onSubmit={submit}>
          <div><p className="eyebrow">Pagamento seguro por PIX</p><h1>Finalize seu plano</h1></div>
          <fieldset className="payment-methods">
            <legend>Forma de pagamento</legend>
            <div className="pix-method"><span aria-hidden="true">◆</span><strong>PIX</strong><small>Confirmação automática e segura</small></div>
          </fieldset>
          <label>CPF ou CNPJ<input inputMode="numeric" onChange={(e) => setDocument(e.target.value)} required value={document} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {pix && (
            <section className="pix-box">
              <h2>PIX gerado</h2>
              <p>Escaneie ou copie o código. O plano será ativado após a confirmação.</p>
              {pix.image && <img alt="QR Code PIX" src={`data:image/png;base64,${pix.image}`} />}
              <textarea readOnly rows="4" value={pix.code} />
              <button className="button button-secondary" disabled={!pix.code} onClick={copyPixCode} type="button">Copiar código PIX</button>
              {copyMessage && <p className={copyMessage.startsWith("Código") ? "form-success" : "form-error"} role="status">{copyMessage}</p>}
              {paymentMessage && <p className={paymentStatus === "error" ? "form-error" : "muted"} role="status">{paymentMessage}</p>}
              {checkoutPaymentId && ["error", "timeout"].includes(paymentStatus) && (
                <button className="button button-secondary" onClick={() => void poll(checkoutPaymentId, true)} type="button">
                  Verificar pagamento novamente
                </button>
              )}
            </section>
          )}
          {!pix && <button className="button button-full" disabled={processing} type="submit">{processing ? "Gerando PIX..." : "Gerar PIX"}</button>}
        </form>
        <aside className="panel checkout-summary">
          <p className="eyebrow">Resumo</p><h2>{plan.nome}</h2>
          <ul>{planFeatures(plan).map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
          <div className="checkout-total"><span>Total mensal</span><strong>{formatCurrency(plan.valor)}</strong></div>
          <small>O plano só é ativado depois que o pagamento for confirmado.</small>
        </aside>
      </div>
    </main>
  );
}
