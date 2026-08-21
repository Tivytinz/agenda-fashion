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
import { useRetryingMedia } from "../hooks/useRetryingMedia";

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

const PAGE_SIZE = 12;

export function buildCatalogPath({
  query = "",
  category = "",
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

  return `/negocios-publicos?${params.toString()}`;
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
  coverSource,
  label,
  onSelect,
  subtitle
}) {
  const {
    handleError,
    hasImage,
    imageUrl
  } = useRetryingMedia(coverSource, {
    width: 420,
    fit: "cover"
  });

  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={active
        ? "home-category-card active"
        : "home-category-card"}
      onClick={() => onSelect(category)}
      type="button"
    >
      <span className="home-category-visual">
        {hasImage ? (
          <img
            alt=""
            loading="lazy"
            onError={handleError}
            src={imageUrl}
          />
        ) : (
          <span
            aria-hidden="true"
            className="home-category-emoji"
          >
            {serviceCategoryEmoji(category, label)}
          </span>
        )}

        <span className="home-category-shade" />
      </span>

      <span className="home-category-copy">
        <span>
          <strong>{label}</strong>
          <small>{subtitle}</small>
        </span>

        <span
          aria-hidden="true"
          className="home-category-arrow"
        >
          →
        </span>
      </span>
    </button>
  );
}

export function ExplorePage() {
  const [businesses, setBusinesses] =
    useState([]);

  const [query, setQuery] =
    useState("");

  const [category, setCategory] =
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
  }, [category, query]);

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

    return [...groups.entries()];
  }, [filteredServices]);

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

  const featuredService = useMemo(() => {
    return filteredServices.find(
      (service) => service.foto_url
    ) || filteredServices[0] || null;
  }, [filteredServices]);

  const featuredBusiness = useMemo(() => {
    return sortedBusinesses.find(
      (business) => business.foto_url
    ) || sortedBusinesses[0] || null;
  }, [sortedBusinesses]);

  const {
    handleError: handleHeroImageError,
    hasImage: hasHeroImage,
    imageUrl: heroImageUrl
  } = useRetryingMedia(
    featuredService?.foto_url ||
      featuredBusiness?.foto_url,
    {
      width: 1440,
      fit: "cover"
    }
  );

  const categoryCovers = useMemo(() => {
    return new Map(
      CATEGORY_SPOTLIGHTS.map(([value]) => {
        const matchingService = services.find(
          (service) =>
            service.categoria === value &&
            service.foto_url
        );

        return [value, matchingService?.foto_url || ""];
      })
    );
  }, [services]);

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

  return (
    <main className="home-page">
      <section className="home-hero">
        <div
          className={hasHeroImage
            ? "container home-hero-frame has-image"
            : "container home-hero-frame"}
        >
          {hasHeroImage && (
            <img
              alt=""
              className="home-hero-image"
              fetchPriority="high"
              onError={handleHeroImageError}
              src={heroImageUrl}
            />
          )}

          <div className="home-hero-overlay" />

          <div className="home-hero-content">
            <p className="home-hero-kicker">
              Agenda Fashion <span>•</span> Beleza perto de você
            </p>

            <h1>
              Seu próximo cuidado começa aqui
            </h1>

            <p>
              Descubra profissionais, compare serviços
              e agende seu horário em poucos passos.
            </p>

            <div className="home-hero-actions">
              <a
                className="button home-hero-primary"
                href="#buscar-servicos"
              >
                Encontrar serviço
                <span aria-hidden="true">→</span>
              </a>

              <a
                className="button home-hero-secondary"
                href="#businesses-title"
              >
                Ver profissionais
              </a>
            </div>
          </div>

          <div
            className="home-search-panel"
            id="buscar-servicos"
          >
            <label className="search-box home-search-box">
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

            <span className="home-search-hint">
              Busque por unha, cabelo, bronzeamento ou profissional
            </span>
          </div>
        </div>
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

          <button
            aria-pressed={category === ""}
            className="home-see-all"
            onClick={() => chooseCategory("")}
            type="button"
          >
            Ver todos
          </button>
        </div>

        <div
          aria-label="Categorias"
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
              coverSource={categoryCovers.get(value)}
              key={value}
              label={label}
              onSelect={chooseCategory}
              subtitle={subtitle}
            />
          ))}
        </div>
      </section>

      <section
        className="container content-section home-catalog-section"
        aria-labelledby="services-title"
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

                    {group.length > 1 && (
                      <span className="service-rail-hint">
                        {group.length} opções
                        <strong>Deslize →</strong>
                      </span>
                    )}
                  </div>

                  <div
                    aria-label={`Serviços de ${label}`}
                    className="service-rail-track"
                    tabIndex={group.length > 1 ? 0 : undefined}
                  >
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
            className="container content-section businesses-section home-businesses-section"
            aria-labelledby="businesses-title"
          >
            <div className="home-section-heading">
              <div>
                <p className="eyebrow">
                  Profissionais e negócios
                </p>

                <h2 id="businesses-title">
                  Perto de você
                </h2>
              </div>
            </div>

            {sortedBusinesses.length > 0 ? (
              <div
                aria-label="Profissionais e negócios perto de você"
                className="home-business-rail"
                tabIndex={sortedBusinesses.length > 1 ? 0 : undefined}
              >
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
