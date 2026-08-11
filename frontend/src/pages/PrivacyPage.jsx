import {
  useEffect,
  useState
} from "react";
import { Link } from "react-router-dom";
import {
  getMarketingConsent,
  MARKETING_CONSENT,
  MARKETING_CONSENT_EVENT,
  setMarketingConsent
} from "../analytics/marketingConsent";
import {
  clearMetaCookies,
  getMetaConfig,
  initializeMetaAds,
  syncMetaConsent
} from "../analytics/metaAds";

function statusLabel(status) {
  if (
    status ===
      MARKETING_CONSENT.GRANTED
  ) {
    return "Permitida";
  }

  if (
    status ===
      MARKETING_CONSENT.DENIED
  ) {
    return "Não permitida";
  }

  return "Ainda não escolhida";
}

export function PrivacyPage() {
  const [config, setConfig] =
    useState(null);
  const [consent, setConsent] =
    useState(getMarketingConsent);

  useEffect(() => {
    getMetaConfig().then(setConfig);
  }, []);

  useEffect(() => {
    function handleConsent(event) {
      setConsent(
        event.detail?.status ||
          getMarketingConsent()
      );
    }

    window.addEventListener(
      MARKETING_CONSENT_EVENT,
      handleConsent
    );

    return () => window.removeEventListener(
      MARKETING_CONSENT_EVENT,
      handleConsent
    );
  }, []);

  async function choose(status) {
    setMarketingConsent(status);
    setConsent(status);

    if (
      status ===
        MARKETING_CONSENT.GRANTED
    ) {
      await initializeMetaAds()
        .catch(() => false);
    } else {
      clearMetaCookies();
    }

    await syncMetaConsent()
      .catch(() => {});
  }

  return (
    <main className="container page-content narrow-page privacy-page">
      <Link className="back-link" to="/">
        ← Voltar ao Agenda Fashion
      </Link>

      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Seus dados, sua escolha</p>
          <h1>Privacidade e cookies</h1>
          <p>
            Esta página explica a medição opcional de anúncios do Agenda Fashion e permite alterar sua escolha quando quiser.
          </p>
        </div>
      </header>

      <section className="panel privacy-section">
        <h2>O que é necessário para o site funcionar</h2>
        <p>
          O Agenda Fashion usa armazenamento local e dados de sessão para recursos como login, segurança, preferências e continuidade dos fluxos. Esses recursos não dependem da Meta.
        </p>
      </section>

      <section className="panel privacy-section">
        <h2>Medição opcional da Meta</h2>
        <p>
          Quando essa integração estiver habilitada e você permitir, o site poderá carregar o Meta Pixel e enviar conversões pela Conversions API para medir se campanhas resultam em cadastro profissional, início de checkout e assinatura ativada.
        </p>
        <p>
          Nas conversões, identificadores como e-mail e telefone podem ser normalizados e transformados em hash no servidor antes do envio. O token da Conversions API permanece somente no backend.
        </p>
        <p>
          Se você não permitir, o Pixel não é carregado pelo Agenda Fashion e os identificadores opcionais de medição da Meta não são mantidos na atribuição da sua conta.
        </p>
      </section>

      <section className="panel privacy-section">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Preferência atual</p>
            <h2>{statusLabel(consent)}</h2>
          </div>
        </div>

        {config?.enabled ? (
          <div className="marketing-consent-actions privacy-actions">
            <button
              aria-pressed={
                consent ===
                  MARKETING_CONSENT.DENIED
              }
              className="button button-secondary"
              onClick={() => choose(
                MARKETING_CONSENT.DENIED
              )}
              type="button"
            >
              Não permitir
            </button>
            <button
              aria-pressed={
                consent ===
                  MARKETING_CONSENT.GRANTED
              }
              className="button button-secondary"
              onClick={() => choose(
                MARKETING_CONSENT.GRANTED
              )}
              type="button"
            >
              Permitir
            </button>
          </div>
        ) : (
          <p className="muted">
            A integração de publicidade da Meta está desativada no Agenda Fashion neste momento.
          </p>
        )}
      </section>
    </main>
  );
}
