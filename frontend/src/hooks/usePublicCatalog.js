import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/client";
import { buildCatalogPath } from "../utils/discoveryCatalog";

export function usePublicCatalog({ query, category, city, state, enabled = true }) {
  const [businesses, setBusinesses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationsReady, setLocationsReady] = useState(false);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);
  const pending = useRef(null);

  const loadBusinesses = useCallback(async ({ requestedPage = 1, append = false } = {}) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const requestId = ++generation.current;
    setError("");
    if (append) setLoadingMore(true);
    else { setStatus("loading"); setLoadingMore(false); }
    try {
      const data = await apiRequest(buildCatalogPath({ query, category, city, state, page: requestedPage }), { signal: controller.signal });
      if (controller.signal.aborted || requestId !== generation.current) return;
      const received = Array.isArray(data.negocios) ? data.negocios : [];
      setBusinesses((current) => append
        ? [...new Map([...current, ...received].map((business) => [business.id, business])).values()]
        : received);
      setPage(requestedPage);
      setHasMore(Boolean(data.paginacao?.tem_mais));
      if (!append && Array.isArray(data.localidades)) {
        setLocations(data.localidades);
        setLocationsReady(true);
      }
      setStatus("ready");
    } catch (requestError) {
      if (controller.signal.aborted || requestId !== generation.current) return;
      setError(requestError.message);
      if (!append) setStatus("error");
    } finally {
      if (requestId === generation.current) {
        pending.current = null;
        setLoadingMore(false);
      }
    }
  }, [query, category, city, state]);

  useEffect(() => {
    if (enabled) void loadBusinesses();
    return () => {
      generation.current += 1;
      pending.current?.abort();
      pending.current = null;
    };
  }, [enabled, loadBusinesses]);

  function loadMore() {
    if (!enabled || pending.current || status !== "ready" || !hasMore) return;
    return loadBusinesses({ requestedPage: page + 1, append: true });
  }

  return { businesses, locations, locationsReady, status, error, hasMore, loadingMore, loadBusinesses, loadMore };
}
