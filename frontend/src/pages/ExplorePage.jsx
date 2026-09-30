import {
  Children,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { useSearchParams } from "react-router-dom";

import { apiRequest } from "../api/client";
import { track } from "../analytics/trackEvent";
import sobrancelhasEmoji from "../assets/icons/sobrancelhas-emoji.png";
import { HomeHero } from "../components/HomeHero";
import { BusinessCard } from "../components/BusinessCard";
import { ServiceCard } from "../components/ServiceCard";

import {
  EmptyState,
  ErrorState,
  LoadingState
} from "../components/ScreenState";

import { normalizeText } from "../utils/format";
import {
  serviceCategoryEmoji,
  serviceCategoryLabel
} from "../utils/specialties";

const CATEGORY_SPOTLIGHTS = [
  ["unha", "Unhas", "Manicure e pedicure"],
  ["cabelo", "Cabelos", "Cortes e tratamentos"],
  ["estetica", "Estética", "Cuidados para você"],
  ["bronzeamento", "Bronzeamento", "Seu tom, seu momento"],
  ["cilio", "Cílios", "Realce seu olhar"],
  ["sobrancelha", "Sobrancelhas", "Design e expressão"],
  ["maquiagem", "Maquiagem", "Produções especiais"]
];

const CATEGORY_CODES = new Set(
  CATEGORY_SPOTLIGHTS.map(([value]) => value)
);

const CATEGORY_ORDER = new Map(
  CATEGORY_SPOTLIGHTS.map(([, label], index) => [label, index])
);

const LOCATION_STORAGE_KEY = "af_catalog_location";

const PAGE_SIZE = 12;

export function buildCatalogPath({
  query = "",
  category = "",
  city = "",
  state = "",
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

  if (city.trim()) {
    params.set("cidade", city.trim());
  }

  if (/^[A-Z]{2}$/.test(state.trim().toUpperCase())) {
    params.set("estado", state.trim().toUpperCase());
  }

  return `/negocios-publicos?${params.toString()}`;
}

function locationKey(city, state) {
  const normalizedCity = String(city || "").trim();
  const normalizedState = String(state || "").trim().toUpperCase();

  if (!normalizedCity || !/^[A-Z]{2}$/.test(normalizedState)) {
    return "";
  }

  return `${normalizedCity}::${normalizedState}`;
}

function parseLocationKey(value) {
  const key = String(value || "");
  const separator = key.lastIndexOf("::");

  if (separator < 1) {
    return { city: "", state: "" };
  }

  const city = key.slice(0, separator).trim();
  const state = key.slice(separator + 2).trim().toUpperCase();

  return /^[A-Z]{2}$/.test(state) && city
    ? { city, state }
    : { city: "", state: "" };
}

function storedLocationKey() {
  try {
    return window.localStorage.getItem(LOCATION_STORAGE_KEY) || "";
  } catch {
    return "";
  }
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

function CategorySpotlightCard({
  active,
  category,
  label,
  onSelect,
  subtitle
}) {
  const customEyebrowEmoji = category === "sobrancelha";

  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={active
        ? "home-category-card active"
        : "home-category-card"}
      onClick={() => onSelect(active ? "" : category)}
      type="button"
    >
      <span className="home-category-visual">
        <span
          aria-hidden="true"
          className={customEyebrowEmoji
            ? "home-category-emoji is-custom-eyebrow"
            : "home-category-emoji"}
          style={customEyebrowEmoji
            ? { "--eyebrow-emoji-url": `url(${sobrancelhasEmoji})` }
            : undefined}
        >
          {customEyebrowEmoji
            ? ""
            : serviceCategoryEmoji(category, label)}
        </span>

        <span className="home-category-shade" />
      </span>

      <span className="home-category-copy">
        <span>
          <strong>{label}</strong>
          <small>{subtitle}</small>
        </span>

      </span>
    </button>
  );
}

function HorizontalRail({
  ariaLabel,
  children,
  className
}) {
  const trackRef = useRef(null);
  const itemCount = Children.count(children);
  const [scrollState, setScrollState] = useState({
    previous: false,
    next: false
  });

  const updateScrollState = useCallback(() => {
    const track = trackRef.current;

    if (!track) return;

    const maximum = Math.max(track.scrollWidth - track.clientWidth, 0);

    setScrollState({
      previous: track.scrollLeft > 4,
      next: maximum > 4 && track.scrollLeft < maximum - 4
    });
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);

    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(updateScrollState)
      : null;

    if (observer && trackRef.current) {
      observer.observe(trackRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateScrollState);
      observer?.disconnect();
    };
  }, [itemCount, updateScrollState]);

  function move(direction) {
    const track = trackRef.current;

    if (!track) return;

    const distance = Math.max(track.clientWidth * 0.82, 280) * direction;

    if (typeof track.scrollBy === "function") {
      track.scrollBy({ left: distance, behavior: "smooth" });
    } else {
      track.scrollLeft += distance;
    }

    window.requestAnimationFrame(updateScrollState);
  }

  return (
    <div className="home-rail-shell">
      {scrollState.previous && (
        <button
          aria-label={`Voltar em ${ariaLabel.toLocaleLowerCase("pt-BR")}`}
          className="home-rail-control previous"
          onClick={() => move(-1)}
          type="button"
        >
          ‹
        </button>
      )}

      <div
        aria-label={ariaLabel}
        className={className}
        onScroll={updateScrollState}
        ref={trackRef}
        tabIndex={scrollState.previous || scrollState.next ? 0 : undefined}
      >
        {children}
      </div>

      {scrollState.next && (
        <button
          aria-label={`Avançar em ${ariaLabel.toLocaleLowerCase("pt-BR")}`}
          className="home-rail-control next"
          onClick={() => move(1)}
          type="button"
        >
          ›
        </button>
      )}
    </div>
  );
}

export function ExplorePage({ renderHero = true }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedQuery =
    searchParams.get("busca") || "";

  const requestedCategory =
    searchParams.get("categoria") || "";

  const requestedLocationKey = locationKey(
    searchParams.get("cidade"),
    searchParams.get("estado")
  );

  const [businesses, setBusinesses] =
    useState([]);

  const query = requestedQuery;
  const category = CATEGORY_CODES.has(requestedCategory) ? requestedCategory : "";

  const selectedLocationKey = requestedLocationKey;
  const [locationRestored, setLocationRestored] = useState(false);

  const [locations, setLocations] =
    useState([]);

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
  const selectedLocation = parseLocationKey(selectedLocationKey);

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
          city: selectedLocation.city,
          state: selectedLocation.state,
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

      if (!append && Array.isArray(data.localidades)) {
        setLocations(data.localidades);
      }
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
  }, [category, query, selectedLocation.city, selectedLocation.state]);

  useEffect(() => {
    if (!locationRestored) {
      setLocationRestored(true);
      const stored = parseLocationKey(storedLocationKey());
      if (!requestedLocationKey && stored.city && stored.state) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("cidade", stored.city);
        nextParams.set("estado", stored.state);
        setSearchParams(nextParams, { replace: true });
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
  }, [locationRestored, requestedLocationKey, searchParams, setSearchParams]);

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

            negocio_descricao: business.descricao,
            negocio_areas: business.areas,

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
            service.negocio_descricao,
            service.negocio_areas?.join(" "),
            service.negocio_cidade,
            service.negocio_estado,
            service.negocio_bairro
          ].join(" ")
        );

        return terms.every((term) => haystack.includes(term));
      });

      return diversifyServices(filtered);
    }, [query, services]);

  const serviceGroups = useMemo(() => {
    const groups = new Map();

    filteredServices.forEach((service) => {
      const label = serviceCategoryLabel(service.categoria);
      const group = groups.get(label) || [];
      group.push(service);
      groups.set(label, group);
    });

    return [...groups.entries()].sort(
      ([labelA], [labelB]) =>
        (CATEGORY_ORDER.get(labelA) ?? Number.MAX_SAFE_INTEGER) -
        (CATEGORY_ORDER.get(labelB) ?? Number.MAX_SAFE_INTEGER) ||
        labelA.localeCompare(labelB, "pt-BR")
    );
  }, [filteredServices]);

  const locationOptions = useMemo(() => {
    const options = new Map();

    locations.forEach((location) => {
      const key = locationKey(location?.cidade, location?.estado);
      if (key) options.set(key, location);
    });

    if (selectedLocationKey && !options.has(selectedLocationKey)) {
      options.set(selectedLocationKey, {
        cidade: selectedLocation.city,
        estado: selectedLocation.state,
        total_negocios: 0
      });
    }

    return [...options.entries()].sort(([, locationA], [, locationB]) =>
      `${locationA.cidade}-${locationA.estado}`.localeCompare(
        `${locationB.cidade}-${locationB.estado}`,
        "pt-BR"
      )
    );
  }, [locations, selectedLocation.city, selectedLocation.state, selectedLocationKey]);

  const sortedBusinesses =
    useMemo(() => {
      return [...businesses].sort(
        (businessA, businessB) => {
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
    }, [businesses]);

  async function loadMore() {
    await loadBusinesses({
      requestedPage: page + 1,
      append: true
    });
  }

  function chooseCategory(value) {
    const nextParams = new URLSearchParams(searchParams);

    if (value) {
      nextParams.set("categoria", value);
    } else {
      nextParams.delete("categoria");
    }
    nextParams.delete("pagina");

    setSearchParams(nextParams, { replace: true });

    track("categoria_selecionada", {
      page: "inicio",
      mission: "descobrir_servico",
      properties: {
        categoria: value || "todos"
      }
    });
  }

  function chooseLocation(value) {
    const nextLocation = parseLocationKey(value);
    const nextKey = locationKey(nextLocation.city, nextLocation.state);
    const nextParams = new URLSearchParams(searchParams);

    if (nextKey) {
      nextParams.set("cidade", nextLocation.city);
      nextParams.set("estado", nextLocation.state);
    } else {
      nextParams.delete("cidade");
      nextParams.delete("estado");
    }
    nextParams.delete("pagina");

    setSearchParams(nextParams, { replace: true });
  }

  function clearFilters() {
    const nextParams = new URLSearchParams(searchParams);
    ["busca", "categoria", "cidade", "estado", "pagina"].forEach((key) => nextParams.delete(key));
    setSearchParams(nextParams, { replace: true });
  }

  function exploreHeroCategory(value) {
    chooseCategory(value);

    window.requestAnimationFrame(() => {
      document
        .getElementById("buscar-servicos")
        ?.scrollIntoView({ block: "start" });
    });
  }

  return (
    <div className={renderHero ? "home-page" : "home-discovery-content"}>
      {renderHero && <HomeHero onExploreCategory={exploreHeroCategory} />}

      <section
        aria-label="Filtros de descoberta"
        className="container home-discovery-filters"
        id={renderHero ? "buscar-servicos" : undefined}
      >
        <label className="home-location-pill">
          <span aria-hidden="true">📍</span>
          <span>Onde?</span>
          <select
            aria-label="Escolher localização"
            onChange={(event) => chooseLocation(event.target.value)}
            value={selectedLocationKey}
          >
            <option value="">Todo o Brasil</option>
            {locationOptions.map(([key, location]) => (
              <option key={key} value={key}>{location.cidade}, {location.estado}</option>
            ))}
          </select>
        </label>
        {(query || category || selectedLocationKey) && (
          <div className="home-active-filters">
            {query && <span>Busca: <strong>{query}</strong></span>}
            {category && <span>Categoria: <strong>{serviceCategoryLabel(category)}</strong></span>}
            <button className="text-button" onClick={clearFilters} type="button">Limpar filtros</button>
          </div>
        )}
      </section>

      <section
        aria-labelledby="categories-title"
        className="container home-category-section"
      >
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">
              Encontre seu cuidado
            </p>

            <h2 id="categories-title">
              Categorias em destaque
            </h2>
          </div>

        </div>

        <HorizontalRail
          ariaLabel="Categorias"
          className="home-category-rail"
        >
          {CATEGORY_SPOTLIGHTS.map(([
            value,
            label,
            subtitle
          ]) => (
            <CategorySpotlightCard
              active={category === value}
              category={value}
              key={value}
              label={label}
              onSelect={chooseCategory}
              subtitle={subtitle}
            />
          ))}
        </HorizontalRail>
      </section>

      {status === "ready" && (
        <section
          aria-labelledby="businesses-title"
          className="container content-section businesses-section home-businesses-section"
        >
          <div className="home-section-heading nearby-heading">
            <div className="home-title-with-icon">
              <span aria-hidden="true">📍</span>

              <h2 id="businesses-title">
                {selectedLocation.city
                  ? `Espaços e profissionais em ${selectedLocation.city}`
                  : "Espaços e profissionais no Agenda Fashion"}
              </h2>
            </div>

          </div>

          {sortedBusinesses.length > 0 ? (
            <HorizontalRail
              ariaLabel={selectedLocation.city
                ? `Profissionais e negócios em ${selectedLocation.city}`
                : "Profissionais e negócios no Agenda Fashion"}
              className="home-business-rail"
            >
              {sortedBusinesses.map(
                (business) => (
                  <BusinessCard
                    business={business}
                    key={business.id}
                  />
                )
              )}
            </HorizontalRail>
          ) : (
            <EmptyState title="Nenhum negócio encontrado">
              Tente outra categoria, serviço ou localização.
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

          {error && (
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

      <section
        aria-labelledby="services-title"
        className="container content-section home-catalog-section"
        id="servicos"
      >
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">
              Escolhas para você
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
                  <div className="service-rail-heading">
                    {serviceGroups.length > 1 && (
                      <h3 className="service-rail-title">{label}</h3>
                    )}

                  </div>

                  <HorizontalRail
                    ariaLabel={`Serviços de ${label}`}
                    className="service-rail-track"
                  >
                    {group.map((service) => (
                      <ServiceCard
                        service={service}
                        key={`${service.negocio_id}-${service.id}`}
                      />
                    ))}
                  </HorizontalRail>
                </section>
              ))}
            </div>
          )}
      </section>

      <section
        aria-labelledby="how-it-works-title"
        className="container content-section home-how-it-works"
        id="como-funciona"
      >
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">Agendamento simples</p>
            <h2 id="how-it-works-title">Como funciona</h2>
          </div>
        </div>

        <ol className="home-how-it-works-steps">
          <li>
            <span aria-hidden="true">1</span>
            <div>
              <strong>Escolha o serviço</strong>
              <p>Compare opções, valores e profissionais.</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">2</span>
            <div>
              <strong>Selecione o horário</strong>
              <p>Veja a disponibilidade real e escolha o melhor momento.</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">3</span>
            <div>
              <strong>Confirme o agendamento</strong>
              <p>Acompanhe tudo pelo AF e receba os avisos autorizados.</p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
