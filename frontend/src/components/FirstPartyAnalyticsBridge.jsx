import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  startFirstPartyPageView
} from "../analytics/firstPartyAnalytics";

export function FirstPartyAnalyticsBridge() {
  const location = useLocation();

  useEffect(() => {
    startFirstPartyPageView({
      pathname: location.pathname,
      search: location.search,
      state: location.state
    });
  }, [
    location.key,
    location.pathname,
    location.search,
    location.state
  ]);

  return null;
}
