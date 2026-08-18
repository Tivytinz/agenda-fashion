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
  applyGoogleConsentDefault,
  getGoogleConfig,
  initializeGoogleMeasurement,
  syncGoogleConsent,
  trackGooglePageView,
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
  syncMetaConsent,
  trackMetaPageView
} from "../analytics/metaAds";

export function MetaAdsBridge() {
  const location = useLocation();
  const session = useSession();
  const [metaConfig, setMetaConfig] =
    useState(null);
  const [googleConfig, setGoogleConfig] =
    useState(null);
  const [consent, setConsent] =
    useState(getMarketingConsent);

  useEffect(() => {
    let active = true;

    Promise.all([
      getMetaConfig(),
      getGoogleConfig()
    ]).then(([
      nextMetaConfig,
      nextGoogleConfig
    ]) => {
      if (!active) {
        return;
      }

      setMetaConfig(nextMetaConfig);
      setGoogleConfig(nextGoogleConfig);

      if (nextGoogleConfig?.enabled) {
        applyGoogleConsentDefault();
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
    if (!metaConfig?.enabled) {
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
    metaConfig?.enabled,
    consent,
    session.authenticated
  ]);

  useEffect(() => {
    if (!googleConfig?.enabled) {
      return;
    }

    if (
      consent ===
        MARKETING_CONSENT.GRANTED
    ) {
      void initializeGoogleMeasurement(
        session.usuario?.id
      )
        .then(() => syncGoogleConsent())
        .catch(() => {});
      return;
    }

    if (
      consent ===
        MARKETING_CONSENT.DENIED
    ) {
      updateGoogleConsent(
        MARKETING_CONSENT.DENIED
      );
      void syncGoogleConsent()
        .catch(() => {});
      return;
    }

    applyGoogleConsentDefault();
  }, [
    googleConfig?.enabled,
    consent,
    session.authenticated,
    session.usuario?.id
  ]);

  useEffect(() => {
    if (
      metaConfig?.enabled &&
      consent ===
        MARKETING_CONSENT.GRANTED
    ) {
      void trackMetaPageView(
        location.pathname
      );
    }

    if (
      googleConfig?.enabled &&
      consent ===
        MARKETING_CONSENT.GRANTED
    ) {
      void trackGooglePageView(
        `${location.pathname}${location.search}`,
        session.usuario?.id
      );
    }
  }, [
    metaConfig?.enabled,
    googleConfig?.enabled,
    consent,
    location.pathname,
    location.search,
    session.usuario?.id
  ]);

  function choose(status) {
    setMarketingConsent(status);
    setConsent(status);
  }

  const measurementEnabled =
    Boolean(
      metaConfig?.enabled ||
      googleConfig?.enabled
    );

  if (!measurementEnabled) {
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
        <div className="marketing-consent-copy">
          <strong>Privacidade e medição de anúncios</strong>
          <p>
            O Agenda Fashion pode usar ferramentas opcionais da Meta e do Google para entender se anúncios resultam em cadastros e assinaturas. Elas só são ativadas se você permitir.
          </p>
          <Link to="/privacidade">
            Entender como funciona
          </Link>
        </div>
        <div
          aria-label="Escolha de medição de anúncios"
          className="marketing-consent-actions"
        >
          <button
            className="btn btn-secondary"
            onClick={() => choose(MARKETING_CONSENT.DENIED)}
            type="button"
          >
            Recusar opcionais
          </button>
          <button
            className="btn"
            onClick={() => choose(MARKETING_CONSENT.GRANTED)}
            type="button"
          >
            Permitir medição
          </button>
        </div>
      </aside>
    );
  }

  return null;
}
