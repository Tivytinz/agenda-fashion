import {
  useEffect,
  useState
} from "react";
import { Link } from "react-router-dom";
import {
  clearGoogleCookies,
  getGoogleConfig,
  initializeGoogleMeasurement,
  syncGoogleConsent,
  updateGoogleConsent
} from "../analytics/googleMeasurement";
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
  const [metaConfig, setMetaConfig] =
    useState(null);
  const [googleConfig, setGoogleConfig] =
    useState(null);
  const [consent, setConsent] =
    useState(getMarketingConsent);

  useEffect(() => {
    Promise.all([
      getMetaConfig(),
      getGoogleConfig()
    ]).then(([
      nextMetaConfig,
      nextGoogleConfig
    ]) => {
      setMetaConfig(nextMetaConfig);
      setGoogleConfig(nextGoogleConfig);
    });
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
      await Promise.all([
        metaConfig?.enabled
          ? initializeMetaAds()
              .catch(() => false)
          : Promise.resolve(false),
        googleConfig?.enabled
          ? initializeGoogleMeasurement()
              .catch(() => false)
          : Promise.resolve(false)
      ]);
    } else {
      if (metaConfig?.enabled) {
        clearMetaCookies();
      }

      if (googleConfig?.enabled) {
        clearGoogleCookies();
        updateGoogleConsent(
          MARKETING_CONSENT.DENIED
        );
      }
    }

    await Promise.all([
      metaConfig?.enabled
        ? syncMetaConsent()
            .catch(() => false)
        : Promise.resolve(false),
      googleConfig?.enabled
        ? syncGoogleConsent()
            .catch(() => false)
        : Promise.resolve(false)
    ]);
  }

  const measurementEnabled =
    Boolean(
      metaConfig?.enabled ||
      googleConfig?.enabled
    );

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
          O Agenda Fashion usa armazenamento local e dados de sessão para recursos como login, segurança, preferências e continuidade dos fluxos. Esses recursos não dependem das ferramentas opcionais da Meta ou do Google.
        </p>
      </section>

      <section className="panel privacy-section">
        <h2>Medição opcional de anúncios e analytics</h2>
        <p>
          Quando as integrações estiverem habilitadas e você permitir, o site poderá usar Meta Pixel, Google Analytics e Google Ads para entender se campanhas resultam em visitas, cadastros profissionais, início de checkout e assinaturas ativadas.
        </p>
        <p>
          A Meta também pode receber conversões pelo servidor. Para o Google Analytics, a confirmação do primeiro pagamento de uma assinatura pode ser registrada pelo servidor usando o identificador pseudônimo de medição associado à sessão consentida.
        </p>
        <p>
          Se você não permitir, o Agenda Fashion não carrega as tags opcionais de Meta ou Google e remove os identificadores opcionais de medição que controla no navegador e na atribuição da sua conta.
        </p>
      </section>

      <section className="panel privacy-section">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Preferência atual</p>
            <h2>{statusLabel(consent)}</h2>
          </div>
        </div>

        {measurementEnabled ? (
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
            As integrações opcionais de publicidade e analytics estão desativadas no Agenda Fashion neste momento.
          </p>
        )}
      </section>
    </main>
  );
}
