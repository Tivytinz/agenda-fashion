import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { trackGoogleBeginCheckout } from "../analytics/googleMeasurement";
import {
  createMetaEventContext,
  trackMetaEvent
} from "../analytics/metaAds";
import { apiRequest } from "../api/client";
import { ErrorState, LoadingState } from "../components/ScreenState";
import { formatCurrency } from "../utils/format";
import { planFeatures } from "../utils/plans";

function extractPlans(result) {
  return Array.isArray(result) ? result : result?.planos || [];
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
  const checkoutAttemptRef = useRef({
    fingerprint: "",
    key: "",
    meta: null
  });

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
    const normalizedDocument = document.replace(/\D/g, "");
    const fingerprint = `${plan.id}:${normalizedDocument}`;
    if (checkoutAttemptRef.current.fingerprint !== fingerprint) {
      const uniquePart = globalThis.crypto?.randomUUID?.()
        || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      checkoutAttemptRef.current = {
        fingerprint,
        key: `checkout-${uniquePart}`,
        meta: createMetaEventContext(
          "professional-checkout"
        )
      };
    }
    try {
      const metaContext =
        checkoutAttemptRef.current.meta;
      const checkoutTransactionId =
        checkoutAttemptRef.current.key;
      const result = await apiRequest("/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": checkoutAttemptRef.current.key },
        body: {
          plano_id: plan.id,
          plano_slug: plan.slug,
          forma_pagamento: "pix",
          cpf_cnpj: normalizedDocument,
          ...(metaContext ? { meta: metaContext } : {})
        }
      });
      checkoutAttemptRef.current = {
        fingerprint: "",
        key: "",
        meta: null
      };

      if (metaContext?.event_id) {
        void trackMetaEvent(
          "InitiateCheckout",
          {
            currency: "BRL",
            value: Number(plan.valor || 0),
            content_name: plan.nome
          },
          metaContext.event_id
        );
      }

      void trackGoogleBeginCheckout({
        currency: "BRL",
        value: Number(plan.valor || 0),
        planId: plan.slug || plan.id,
        planName: plan.nome,
        transactionId:
          checkoutTransactionId
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
          <div className="checkout-commercial-notice">
            <strong>Assinatura mensal por PIX</strong>
            <p>
              Uma nova cobrança PIX pode ser gerada a cada ciclo enquanto a renovação estiver ativa. Você pode cancelar antes da próxima renovação; o acesso continua até o fim do período pago.
            </p>
            <small>
              Ao gerar o PIX, você concorda com os <Link to="/termos">Termos de uso</Link> e a <Link to="/privacidade">Política de Privacidade</Link>.
            </small>
          </div>
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
          <small>Sem taxa de adesão. O plano só é ativado depois que o pagamento for confirmado.</small>
        </aside>
      </div>
    </main>
  );
}
