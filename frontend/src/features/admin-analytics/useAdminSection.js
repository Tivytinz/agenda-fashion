import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { normalizeAdminPeriod } from "../../utils/adminPeriods";

export function useAdminSection(section) {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = normalizeAdminPeriod(searchParams.get("periodo"));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setRefreshing(true);
    setError("");

    apiRequest(`/admin/analytics-v2/${section}?periodo=${period}`, {
      signal: controller.signal
    })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (active && requestError.name !== "AbortError") {
          setError(requestError.message || "Não foi possível carregar esta visão administrativa.");
        }
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [period, reloadKey, section]);

  return {
    data,
    error,
    period,
    refreshing,
    retry: () => setReloadKey((current) => current + 1),
    searchParams,
    setSearchParams
  };
}
