import {
  useEffect,
  useState
} from "react";
import {
  Link,
  useLocation
} from "react-router-dom";
import { useSession } from "../auth/SessionContext";
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
  syncMetaConsent,
  trackMetaPageView
} from "../analytics/metaAds";

export function MetaAdsBridge() {
  const location = useLocation();
  const session = useSession();
  const [config, setConfig] =
    useState(null);
  const [consent, setConsent] =
    useState(getMarketingConsent);

  useEffect(() => {
    let active = true;

    getMetaConfig().then((result) => {
      if (active) {
        setConfig(result);
      }
    });

    return () => {
      active = false;
    };
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

    return () => {
      window.removeEventListener(
        MARKETING_CONSENT_EVENT,
        handleConsent
      );
    };
  }, []);

  useEffect(() => {
    if (!config?.enabled) {
      return;
    }

    if (
      consent ===
        MARKETING_CONSENT.GRANTED
    ) {
      void initializeMetaAds()
        .then(() => syncMetaConsent())
        .catch(() => {});
      return;
    }

    if (
      consent ===
        MARKETING_CONSENT.DENIED
    ) {
      clearMetaCookies();
      void syncMetaConsent()
        .catch(() => {});
    }
  }, [
    config?.enabled,
    consent,
    session.authenticated
  ]);

  useEffect(() => {
    if (
      !config?.enabled ||
      consent !==
        MARKETING_CONSENT.GRANTED
    ) {
      return;
    }

    void trackMetaPageView(
      location.pathname
    );
  }, [
    config?.enabled,
    consent,
    location.pathname
  ]);

  function choose(status) {
    setMarketingConsent(status);
    setConsent(status);
  }

  if (!config?.enabled) {
    return null;
  }

  if (
    consent ===
      MARKETING_CONSENT.UNKNOWN
  ) {
    return (
      <aside
        aria-label="Preferências de privacidade"
        className="marketing-consent-banner"
      >
        <div>
          <strong>Privacidade e medição de anúncios</strong>
          <p>
            O Agenda Fashion pode usar ferramentas opcionais da Meta para medir se anúncios resultam em cadastros e assinaturas. Elas só são ativadas se você permitir.
          </p>
          <Link to="/privacidade">
            Entender como funciona
          </Link>
        </div>
        <div className="marketing-consent-actions">
          <button
            className="button button-secondary"
            onClick={() => choose(
              MARKETING_CONSENT.DENIED
            )}
            type="button"
          >
            Não permitir
          </button>
          <button
            className="button button-secondary"
            onClick={() => choose(
              MARKETING_CONSENT.GRANTED
            )}
            type="button"
          >
            Permitir
          </button>
        </div>
      </aside>
    );
  }

  return (
    <Link
      className="privacy-shortcut"
      to="/privacidade"
    >
      Privacidade
    </Link>
  );
}
