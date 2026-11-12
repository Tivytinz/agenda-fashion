import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { startFirstPartyPageView } from "../analytics/firstPartyAnalytics";
import { ANALYTICS_VIEW_READY_EVENT } from "../auth/session";

export function FirstPartyAnalyticsBridge() {
  const location = useLocation();

  useEffect(() => {
    const view = {
      pathname: location.pathname,
      search: location.search,
      state: location.state
    };

    const handleReady = () => {
      // O SessionContext só sinaliza após identidade validada ou logout confirmado.
      // A mesma URL pode ganhar uma nova visualização com nova identidade.
      startFirstPartyPageView({ ...view, resumeAfterBoundary: true });
    };

    window.addEventListener(ANALYTICS_VIEW_READY_EVENT, handleReady);
    startFirstPartyPageView(view);
    return () => window.removeEventListener(ANALYTICS_VIEW_READY_EVENT, handleReady);
  }, [location.key, location.pathname, location.search, location.state]);

  return null;
}
