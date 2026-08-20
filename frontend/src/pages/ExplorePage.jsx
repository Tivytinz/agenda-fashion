import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { apiRequest } from "../api/client";
import { track } from "../analytics/track";
import { BusinessCard } from "../components/BusinessCard";
import { ServiceCard } from "../components/ServiceCard";

import {
  EmptyState,
  ErrorState,
  LoadingState
} from "../components/ScreenState";

import { normalizeText } from "../utils/format";
import { serviceCategoryLabel } from "../utils/specialties";

const CATEGORIES = [
  ["", "Todos"],
  ["unha", "Unhas"],
  ["cabelo", "Cabelos"],
  ["cilio", "Cílios"],
  ["sobrancelha", "Sobrancelhas"],
  ["maquiagem", "Maquiagem"],
  ["estetica", "Estética"]
];

const PAGE_SIZE = 12;

export function buildCatalogPath({
  query = "",
  category = "",
  city = "",
  page = 1
} = {}) {
  const params = new URLSearchParams({
    pagina: String(page),
    limite: String(PAGE_SIZE)
  });

  if (query.trim()) {
    params.set("busca", query.trim());
  }

  if (category) {
    params.set("categoria", category);
  }

  if (city) {
    params.set("cidade", city);
  }

  return `/negocios-publicos?${params.toString()}`;
}

export function distanceInKm(origin, destination) {
  const coordinate = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const latitudeA = coordinate(origin?.latitude);
  const longitudeA = coordinate(origin?.longitude);
  const latitudeB = coordinate(destination?.latitude);
  const longitudeB = coordinate(destination?.longitude);

  if ([latitudeA, longitudeA, latitudeB, longitudeB].some((value) => value === null)) {
    return null;
  }

  const radians = (degrees) => degrees * (Math.PI / 180);
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function diversifyServices(services = []) {
  const queues = new Map();

  services.forEach((service) => {
    const key = String(service.negocio_id ?? service.negocio_slug ?? "");
    const queue = queues.get(key) || [];
    queue.push(service);
    queues.set(key, queue);
  });

  const diversified = [];
  let remaining = true;

  while (remaining) {
    remaining = false;

    for (const queue of queues.values()) {
      const service = queue.shift();

      if (service) {
        diversified.push(service);
        remaining = true;
      }
    }
  }

  return diversified;
}

export function ExplorePage() {
  const [businesses, setBusinesses] =
    useState([]);

  const [query, setQuery] =
    useState("");

  const [category, setCategory] =
    useState("");

  const [city, setCity] =
    useState("");

  const [maximumPrice, setMaximumPrice] =
    useState("");

  const [onlineOnly, setOnlineOnly] =
    useState(false);

  const [ordering, setOrdering] =
    useState("recommended");

  const [userLocation, setUserLocation] =
    useState(null);

  const [locationMessage, setLocationMessage] =
    useState("");

  const [status, setStatus] =
    useState("loading");

  const [error, setError] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [hasMore, setHasMore] =
    useState(false);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const latestRequest = useRef(0);

  const loadBusinesses = useCallback(async ({
    requestedPage = 1,
    append = false,
    signal
  } = {}) => {
    const requestId =
      latestRequest.current + 1;

    latestRequest.current = requestId;

    if (append) {
      setLoadingMore(true);
    } else {
      setStatus("loading");
      setError("");
    }

    try {
      const data = await apiRequest(
        buildCatalogPath({
          query,
          category,
          city,
          page: requestedPage
        }),
        { signal }
      );

      if (requestId !== latestRequest.current) {
        return;
      }

      const received =
        Array.isArray(data.negocios)
          ? data.negocios
          : [];

      setBusinesses(
        (current) =>
          append
            ? [...current, ...received]
            : received
      );

      setPage(requestedPage);
      setHasMore(
        Boolean(data.paginacao?.tem_mais)
      );
      setError("");

      setStatus("ready");
    } catch (requestError) {
      if (
        signal?.aborted ||
        requestId !== latestRequest.current
      ) {
        return;
      }

      setError(requestError.message);
      if (!append) {
        setStatus("error");
      }
    } finally {
      if (
        !signal?.aborted &&
        requestId === latestRequest.current
      ) {
        setLoadingMore(false);
      }
    }
  }, [category, city, query]);

  useEffect(() => {
    const controller =
      new AbortController();

    const timeout = window.setTimeout(
      () => {
        void loadBusinesses({
          requestedPage: 1,
          signal: controller.signal
        });
      },
      query ? 350 : 0
    );

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadBusinesses, query]);

  useEffect(() => {

    track("tela_visualizada", {
      page: "inicio",
      mission: "descobrir_servico"
    });
  }, []);

  const services =
    useMemo(() => {
      return businesses.flatMap(
        (business) => {
          return (
            business.servicos || []
          ).map((service) => ({
            ...service,

            negocio_id:
              business.id,

            negocio_nome:
              business.nome,

            negocio_slug:
              business.slug,

            negocio_setor:
              business.setor,

            negocio_cidade:
              business.cidade,

            negocio_bairro:
              business.bairro,

            negocio_estado:
              business.estado,

            negocio_latitude:
              business.latitude,

            negocio_longitude:
              business.longitude,

            negocio_foto_url:
              business.foto_url
          }));
        }
      );
    }, [businesses]);

  const filteredServices =
    useMemo(() => {
      const wanted = normalizeText(query);

      const terms = wanted
        .split(/\s+/)
        .filter(Boolean);

      const filtered = services.filter((service) => {
        const haystack = normalizeText(
          [
            service.nome,
            service.descricao,
            service.negocio_nome,
            service.negocio_setor,
            service.negocio_cidade,
            service.negocio_bairro
          ].join(" ")
        );

        const matchesSearch = terms.every((term) => haystack.includes(term));
        const price = Number(service.valor);
        const matchesPrice = !maximumPrice ||
          (Number.isFinite(price) && price <= Number(maximumPrice));
        const matchesOnline = !onlineOnly || service.agenda_online === true;

        return matchesSearch && matchesPrice && matchesOnline;
      });

      const withDistance = filtered.map((service) => ({
        ...service,
        distancia_km: userLocation
          ? distanceInKm(userLocation, {
              latitude: service.negocio_latitude,
              longitude: service.negocio_longitude
            })
          : null
      }));

      if (ordering === "price") {
        return withDistance.sort((a, b) => Number(a.valor) - Number(b.valor));
      }

      if (ordering === "distance") {
        return withDistance.sort((a, b) =>
          (a.distancia_km ?? Number.POSITIVE_INFINITY) -
          (b.distancia_km ?? Number.POSITIVE_INFINITY)
        );
      }

      return diversifyServices(withDistance);
    }, [maximumPrice, onlineOnly, ordering, query, services, userLocation]);

  const serviceGroups = useMemo(() => {
    const groups = new Map();

    filteredServices.forEach((service) => {
      const label = serviceCategoryLabel(service.categoria);
      const group = groups.get(label) || [];
      group.push(service);
      groups.set(label, group);
    });

    return [...groups.entries()];
  }, [filteredServices]);

  const availableCities = useMemo(() => {
    return [...new Set(
      businesses
        .map((business) => String(business.cidade || "").trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [businesses]);

  const sortedBusinesses =
    useMemo(() => {
      return [...businesses].map((business) => ({
        ...business,
        distancia_km: userLocation
          ? distanceInKm(userLocation, business)
          : null
      })).sort(
        (businessA, businessB) => {
          if (ordering === "distance") {
            return (
              (businessA.distancia_km ?? Number.POSITIVE_INFINITY) -
              (businessB.distancia_km ?? Number.POSITIVE_INFINITY)
            );
          }

          const servicesA =
            businessA.servicos?.length || 0;

          const servicesB =
            businessB.servicos?.length || 0;

          if (
            Boolean(servicesA) !==
            Boolean(servicesB)
          ) {
            return servicesB - servicesA;
          }

          return String(
            businessA.nome || ""
          ).localeCompare(
            String(businessB.nome || ""),
            "pt-BR"
          );
        }
      );
    }, [businesses, ordering, userLocation]);

  async function loadMore() {
    await loadBusinesses({
      requestedPage: page + 1,
      append: true
    });
  }

  function chooseCategory(value) {
    setCategory(value);

    track("categoria_selecionada", {
      page: "inicio",
      mission: "descobrir_servico",
      properties: {
        categoria: value || "todos"
      }
    });
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Localização indisponível neste navegador.");
      return;
    }

    setLocationMessage("Buscando sua localização...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setOrdering("distance");
        setLocationMessage("Resultados ordenados por proximidade.");
      },
      () => setLocationMessage("Não foi possível acessar sua localização."),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }

  return (
    <main>
      <section className="hero">
        <div className="container hero-content">
          <div className="hero-copy">
            <p className="eyebrow">
              Beleza perto de você
            </p>

            <h1>
              Encontre serviços de beleza perto de você
            </h1>

            <p>
              Inspire-se pelas fotos,
              compare preços e escolha
              um horário em poucos passos.
            </p>
          </div>

          <div className="discovery-panel">
            <label className="search-box">
              <span
                className="search-icon"
                aria-hidden="true"
              >
                ⌕
              </span>

              <span className="sr-only">
                Buscar serviço, negócio
                ou cidade
              </span>

              <input
                type="search"
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value
                  )
                }
                placeholder="Serviço, negócio ou cidade"
              />

              {query && (
                <button
                  aria-label="Limpar busca"
                  className="clear-search"
                  onClick={() =>
                    setQuery("")
                  }
                  type="button"
                >
                  ×
                </button>
              )}
            </label>

            <div
              className="chips"
              aria-label="Categorias"
            >
              {CATEGORIES.map(
                ([value, label]) => (
                  <button
                    aria-pressed={
                      category === value
                    }
                    className={
                      category === value
                        ? "chip active"
                        : "chip"
                    }
                    key={label}
                    type="button"
                    onClick={() =>
                      chooseCategory(
                        value
                      )
                    }
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            <div className="catalog-filters" aria-label="Filtros do catálogo">
              <label>
                <span className="sr-only">Cidade</span>
                <select value={city} onChange={(event) => setCity(event.target.value)}>
                  <option value="">Todas as cidades</option>
                  {availableCities.map((availableCity) => (
                    <option value={availableCity} key={availableCity}>
                      {availableCity}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="sr-only">Preço máximo</span>
                <select
                  value={maximumPrice}
                  onChange={(event) => setMaximumPrice(event.target.value)}
                >
                  <option value="">Qualquer preço</option>
                  <option value="50">Até R$ 50</option>
                  <option value="100">Até R$ 100</option>
                  <option value="150">Até R$ 150</option>
                </select>
              </label>

              <label>
                <span className="sr-only">Ordenar resultados</span>
                <select value={ordering} onChange={(event) => setOrdering(event.target.value)}>
                  <option value="recommended">Recomendados</option>
                  <option value="price">Menor preço</option>
                  <option value="distance" disabled={!userLocation}>Mais próximos</option>
                </select>
              </label>

              <button
                className={userLocation ? "location-filter active" : "location-filter"}
                onClick={requestLocation}
                type="button"
              >
                <span aria-hidden="true">⌖</span>
                {userLocation ? "Localização ativa" : "Usar localização"}
              </button>

              <label className={onlineOnly ? "online-filter active" : "online-filter"}>
                <input
                  checked={onlineOnly}
                  onChange={(event) => setOnlineOnly(event.target.checked)}
                  type="checkbox"
                />
                Com agenda online
              </label>
            </div>

            {locationMessage && (
              <p className="catalog-location-message" role="status">
                {locationMessage}
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        className="container content-section"
        aria-labelledby="services-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              Inspire-se e agende
            </p>

            <h2 id="services-title">
              {query || category
                ? "Serviços encontrados"
                : "Serviços para você"}
            </h2>
          </div>

        </div>

        {status === "loading" && (
          <LoadingState>
            Buscando serviços para
            você...
          </LoadingState>
        )}

        {status === "error" && (
          <ErrorState
            message={error}
            onRetry={loadBusinesses}
          />
        )}

        {status === "ready" &&
          filteredServices.length ===
          0 && (
            <EmptyState title="Nenhum serviço encontrado">
              Tente outra categoria,
              serviço ou cidade.
            </EmptyState>
          )}

        {status === "ready" &&
          filteredServices.length >
          0 && (
            <div className="service-rails">
              {serviceGroups.map(([label, group]) => (
                <section className="service-rail" key={label}>
                  {serviceGroups.length > 1 && (
                    <h3 className="service-rail-title">{label}</h3>
                  )}
                  <div className="service-rail-track">
                    {group.map((service) => (
                      <ServiceCard
                        service={service}
                        key={`${service.negocio_id}-${service.id}`}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
      </section>

      {status === "ready" && (
          <section
            className="container content-section businesses-section"
            aria-labelledby="businesses-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  Conheça quem atende
                </p>

                <h2 id="businesses-title">
                  Negócios e profissionais
                </h2>
              </div>

            </div>

            {sortedBusinesses.length > 0 ? (
              <div className={
                sortedBusinesses.length <= 2
                  ? "card-grid business-card-grid business-card-grid-compact"
                  : "card-grid business-card-grid"
              }>
                {sortedBusinesses.map(
                  (business) => (
                    <BusinessCard
                      business={business}
                      key={business.id}
                    />
                  )
                )}
              </div>
            ) : (
              <EmptyState title="Nenhum negócio encontrado">
                Tente outra categoria, serviço ou cidade.
              </EmptyState>
            )}

            {hasMore && (
              <div className="load-more-row">
                <button
                  className="button button-secondary"
                  disabled={loadingMore}
                  onClick={loadMore}
                  type="button"
                >
                  {loadingMore
                    ? "Carregando..."
                    : "Carregar mais"}
                </button>
              </div>
            )}

            {error && status === "ready" && (
              <p className="inline-error" role="alert">
                {error}{" "}
                <button
                  className="link-button"
                  onClick={loadMore}
                  type="button"
                >
                  Tentar novamente
                </button>
              </p>
            )}
          </section>
        )}
    </main>
  );
}
