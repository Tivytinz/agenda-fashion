import {
  useCallback,
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
  hasPendingGoogleConsentSync,
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
  clearMarketingAttribution
} from "../analytics/track";
import {
  getMetaConfig,
  initializeMetaAds,
  revokeMetaConsent,
  syncMetaConsent,
  trackMetaPageView
} from "../analytics/metaAds";
import {
  GOOGLE_BUSINESS_DATA_URL
} from "../config/legal";

export function isAdminMeasurementRoute(pathname) {
  const normalized = String(pathname || "")
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "");

  return normalized === "/admin" ||
    normalized.startsWith("/admin/");
}

export function MetaAdsBridge() {
  const location = useLocation();
  const session = useSession();
  const [metaConfig, setMetaConfig] =
    useState(null);
  const [googleConfig, setGoogleConfig] =
    useState(null);
  const [consent, setConsent] =
    useState(getMarketingConsent);
  const [googleSyncError, setGoogleSyncError] =
    useState(false);
  const adminMeasurementRoute =
    isAdminMeasurementRoute(location.pathname);

  const retryGoogleSync = useCallback(
    async () => {
      try {
        await syncGoogleConsent();
        setGoogleSyncError(false);
        return true;
      } catch {
        setGoogleSyncError(true);
        return false;
      }
    },
    []
  );

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
    if (
      consent ===
        MARKETING_CONSENT.DENIED
    ) {
      revokeMetaConsent();

      if (metaConfig?.enabled) {
        void syncMetaConsent()
          .catch(() => {});
      }

      return;
    }

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

  }, [
    metaConfig?.enabled,
    consent,
    session.authenticated
  ]);

  useEffect(() => {
    if (googleConfig === null) {
      return;
    }

    if (adminMeasurementRoute) {
      updateGoogleConsent(
        MARKETING_CONSENT.DENIED
      );
      return;
    }

    if (
      consent ===
        MARKETING_CONSENT.GRANTED
    ) {
      if (!googleConfig.enabled) {
        return;
      }

      void initializeGoogleMeasurement(
        session.usuario?.id
      )
        .then(() => retryGoogleSync())
        .catch(() => {
          setGoogleSyncError(true);
        });
      return;
    }

    if (
      consent ===
        MARKETING_CONSENT.DENIED
    ) {
      updateGoogleConsent(
        MARKETING_CONSENT.DENIED
      );
      clearMarketingAttribution();
      void retryGoogleSync();
      return;
    }

    if (googleConfig.enabled) {
      applyGoogleConsentDefault();
    }
  }, [
    googleConfig?.enabled,
    consent,
    session.authenticated,
    session.usuario?.id,
    retryGoogleSync,
    adminMeasurementRoute
  ]);

  useEffect(() => {
    if (
      googleConfig === null ||
      !session.authenticated ||
      consent === MARKETING_CONSENT.UNKNOWN ||
      (
        consent === MARKETING_CONSENT.GRANTED &&
        !googleConfig.enabled
      )
    ) {
      return undefined;
    }

    const retry = () => {
      void retryGoogleSync();
    };
    const retryWhenVisible = () => {
      if (
        document.visibilityState === "visible" &&
        hasPendingGoogleConsentSync()
      ) {
        retry();
      }
    };

    window.addEventListener("online", retry);
    document.addEventListener(
      "visibilitychange",
      retryWhenVisible
    );

    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener(
        "visibilitychange",
        retryWhenVisible
      );
    };
  }, [
    googleConfig,
    session.authenticated,
    consent,
    retryGoogleSync
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
        MARKETING_CONSENT.GRANTED &&
      !adminMeasurementRoute
    ) {
      void trackGooglePageView(
        location.pathname,
        session.usuario?.id
      );
    }
  }, [
    metaConfig?.enabled,
    googleConfig?.enabled,
    consent,
    location.pathname,
    session.usuario?.id,
    adminMeasurementRoute
  ]);

  function choose(status) {
    if (status === MARKETING_CONSENT.DENIED) {
      clearMarketingAttribution();
    }

    setMarketingConsent(status);
    setConsent(status);
  }

  const measurementEnabled =
    Boolean(
      metaConfig?.enabled ||
      googleConfig?.enabled
    );

  if (!measurementEnabled && !googleSyncError) {
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
            Com sua permissão, usamos cookies opcionais do Google Analytics,
            Google Ads e Meta para entender quais anúncios geram visitas,
            cadastros e assinaturas. Negar não limita o AF e a publicidade
            personalizada permanece desativada.
          </p>
          <Link to="/privacidade">
            Entender como funciona
          </Link>
          <span aria-hidden="true"> · </span>
          <a
            href={GOOGLE_BUSINESS_DATA_URL}
            rel="noreferrer"
            target="_blank"
          >
            Como o Google usa dados
          </a>
        </div>
        <div
          aria-label="Escolha de medição de anúncios"
          className="marketing-consent-actions"
          role="group"
        >
          <button
            className="button button-secondary"
            onClick={() => choose(
              MARKETING_CONSENT.DENIED
            )}
            type="button"
          >
            Recusar
          </button>
          <button
            className="button button-secondary"
            onClick={() => choose(
              MARKETING_CONSENT.GRANTED
            )}
            type="button"
          >
            Permitir medição
          </button>
        </div>
      </aside>
    );
  }

  return (
    <>
      {googleSyncError && session.authenticated && (
        <aside
          aria-label="Sincronização de privacidade pendente"
          className="privacy-sync-warning"
          role="status"
        >
          <span>
            Sua escolha vale neste navegador, mas ainda não foi sincronizada com a conta.
          </span>
          <button
            className="text-button"
            onClick={() => void retryGoogleSync()}
            type="button"
          >
            Tentar novamente
          </button>
        </aside>
      )}
      <Link
        className="privacy-shortcut"
        to="/privacidade"
      >
        Privacidade
      </Link>
    </>
  );
}
