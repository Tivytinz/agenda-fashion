import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { track } from "../analytics/trackEvent";
import { CATEGORY_CODES, LOCATION_STORAGE_KEY, locationKey, parseLocationKey, storedLocationKey } from "../utils/discoveryCatalog";

export function useCatalogFilters() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const requestedQuery =
    searchParams.get("busca") || "";

  const requestedCategory =
    searchParams.get("categoria") || "";

  const requestedLocationKey = locationKey(
    searchParams.get("cidade"),
    searchParams.get("estado")
  );

  const query = requestedQuery;
  const category = CATEGORY_CODES.has(requestedCategory) ? requestedCategory : "";
  const selectedLocationKey = requestedLocationKey;
  const selectedLocation = parseLocationKey(selectedLocationKey);
  const [locationRestored, setLocationRestored] = useState(false);

  useEffect(() => {
    if (!locationRestored) {
      setLocationRestored(true);
      const stored = parseLocationKey(storedLocationKey());
      if (!requestedLocationKey && stored.city && stored.state) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("cidade", stored.city);
        nextParams.set("estado", stored.state);
        navigate({
          pathname: location.pathname,
          search: `?${nextParams}`,
          hash: location.hash
        }, { replace: true, state: location.state });
        return;
      }
    }
    try {
      if (requestedLocationKey) {
        window.localStorage.setItem(LOCATION_STORAGE_KEY, requestedLocationKey);
      } else {
        window.localStorage.removeItem(LOCATION_STORAGE_KEY);
      }
    } catch {
      // A URL é a fonte navegável mesmo quando o armazenamento está bloqueado.
    }
  }, [locationRestored, requestedLocationKey, searchParams, navigate, location.pathname, location.hash, location.state]);

  function updateFilters(nextParams, { hash = "#buscar-servicos", replace = true } = {}) {
    navigate({ pathname: location.pathname, search: nextParams.size ? `?${nextParams}` : "", hash }, { replace, state: location.state });
  }

  function chooseCategory(value) {
    const nextParams = new URLSearchParams(searchParams);

    if (value) {
      nextParams.set("categoria", value);
    } else {
      nextParams.delete("categoria");
    }
    nextParams.delete("pagina");

    updateFilters(nextParams);

    track("categoria_selecionada", {
      page: "inicio",
      mission: "descobrir_servico",
      properties: {
        categoria: value || "todos"
      }
    });
  }

  function removeFilter(keys) {
    const nextParams = new URLSearchParams(searchParams);
    [...keys, "pagina"].forEach((key) => nextParams.delete(key));
    updateFilters(nextParams);
  }

  function clearFilters() {
    const nextParams = new URLSearchParams(searchParams);
    ["busca", "categoria", "cidade", "estado", "pagina"].forEach((key) => nextParams.delete(key));
    updateFilters(nextParams);
  }

  function exploreHeroCategory(value) {
    chooseCategory(value);
  }

  function searchCatalog(value, cityKey = selectedLocationKey) {
    const nextParams = new URLSearchParams(searchParams);
    const nextLocation = parseLocationKey(cityKey);
    if (nextLocation.city) {
      nextParams.set("cidade", nextLocation.city);
      nextParams.set("estado", nextLocation.state);
    } else {
      nextParams.delete("cidade");
      nextParams.delete("estado");
    }
    if (value) nextParams.set("busca", value);
    else nextParams.delete("busca");
    nextParams.delete("pagina");
    updateFilters(nextParams, { hash: "#buscar-servicos", replace: false });
  }

  return {
    query, category, selectedLocationKey, selectedLocation, locationRestored,
    location, chooseCategory, removeFilter, clearFilters, exploreHeroCategory, searchCatalog
  };
}
