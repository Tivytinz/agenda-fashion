import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { useSearchParams } from "react-router-dom";

import { apiRequest } from "../api/client";
import { track } from "../analytics/track";
import manicureHero from "../assets/home/manicure-hero.webp";
import salonHero from "../assets/home/salon-hero.webp";
import skincareHero from "../assets/home/skincare-hero.webp";
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

const HERO_SLIDES = [
  {
    image: salonHero,
    title: "Beleza perto de você",
    subtitle: "Encontre seu próximo cuidado",
    description: "Descubra profissionais, compare serviços e agende em poucos passos.",
    category: ""
  },
  {
    image: manicureHero,
    title: "Unhas do seu jeito",
    subtitle: "Cuidado em cada detalhe",
    description: "Encontre manicures, veja opções e escolha o melhor horário para você.",
    category: "unha"
  },
  {
    image: skincareHero,
    title: "Seu momento de cuidado",
    subtitle: "Estética com praticidade",
    description: "Conheça tratamentos, profissionais e horários disponíveis perto de você.",
    category: "estetica"
  }
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
  const [searchParams] = useSearchParams();

  const requestedQuery =
    searchParams.get("busca") || "";

  const [businesses, setBusinesses] =
    useState([]);

  const [query, setQuery] =
    useState(requestedQuery);

  const [activeHero, setActiveHero] =
    useState(0);

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
  const heroTouchStart = useRef(null);

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
    setQuery(requestedQuery);
  }, [requestedQuery]);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    );

    if (mediaQuery?.matches) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setActiveHero((current) =>
        (current + 1) % HERO_SLIDES.length);
    }, 7000);

    return () => window.clearInterval(interval);
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

  const nearbyLocation = useMemo(() => {
    const business = sortedBusinesses[0];
    const city = business?.cidade;
    const state = business?.estado;

    return [city, state]
      .filter(Boolean)
      .join(", ") || "Perto de você";
  }, [sortedBusinesses]);

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

  function showHero(index) {
    const nextIndex =
      (index + HERO_SLIDES.length) %
      HERO_SLIDES.length;

    setActiveHero(nextIndex);
  }

  function handleHeroTouchStart(event) {
    heroTouchStart.current =
      event.touches[0]?.clientX ?? null;
  }

  function handleHeroTouchEnd(event) {
    const start = heroTouchStart.current;
    const end = event.changedTouches[0]?.clientX;
    heroTouchStart.current = null;

    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      Math.abs(start - end) < 45
    ) {
      return;
    }

    showHero(
      activeHero + (start > end ? 1 : -1)
    );
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
    <main className="home-page">
      <section
        aria-label="Destaques do Agenda Fashion"
        aria-roledescription="carrossel"
        className="home-hero"
        onTouchEnd={handleHeroTouchEnd}
        onTouchStart={handleHeroTouchStart}
      >
        <div className="container home-hero-frame">
          <div
            className="home-hero-track"
            style={{
              transform: `translateX(-${activeHero * 100}%)`
            }}
          >
            {HERO_SLIDES.map((slide, index) => (
              <article
                aria-hidden={activeHero !== index}
                aria-label={`${index + 1} de ${HERO_SLIDES.length}`}
                className="home-hero-slide"
                key={slide.title}
              >
                <img
                  alt=""
                  className="home-hero-image"
                  fetchPriority={index === 0 ? "high" : "auto"}
                  src={slide.image}
                />

                <div className="home-hero-overlay" />

                <div className="home-hero-content">
                  <h1>{slide.title}</h1>

                  <p className="home-hero-subtitle">
                    {slide.subtitle}
                  </p>

                  <p className="home-hero-description">
                    {slide.description}
                  </p>

                  <div className="home-hero-actions">
                    <button
                      className="button home-hero-primary"
                      onClick={() => exploreHeroCategory(slide.category)}
                      tabIndex={activeHero === index ? 0 : -1}
                      type="button"
                    >
                      Explorar serviços
                      <span aria-hidden="true">→</span>
                    </button>

                    <a
                      className="button home-hero-secondary"
                      href="#como-funciona"
                      tabIndex={activeHero === index ? 0 : -1}
                    >
                      Como funciona
                      <span
                        aria-hidden="true"
                        className="home-hero-play"
                      >
                        ▷
                      </span>
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <button
            aria-label="Destaque anterior"
            className="home-hero-arrow previous"
            onClick={() => showHero(activeHero - 1)}
            type="button"
          >
            ‹
          </button>

          <button
            aria-label="Próximo destaque"
            className="home-hero-arrow next"
            onClick={() => showHero(activeHero + 1)}
            type="button"
          >
            ›
          </button>

          <div
            aria-label="Escolher destaque"
            className="home-hero-dots"
          >
            {HERO_SLIDES.map((slide, index) => (
              <button
                aria-label={`Mostrar destaque ${index + 1}: ${slide.title}`}
                aria-pressed={activeHero === index}
                key={slide.title}
                onClick={() => showHero(index)}
                type="button"
              />
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="categories-title"
        className="container home-category-section"
        id="buscar-servicos"
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

      {status === "ready" && (
        <section
          aria-labelledby="businesses-title"
          className="container content-section businesses-section home-businesses-section"
        >
          <div className="home-section-heading nearby-heading">
            <div className="home-title-with-icon">
              <span aria-hidden="true">⌖</span>

              <h2 id="businesses-title">
                Perto de você
              </h2>
            </div>

            <span className="home-location-pill">
              <span aria-hidden="true">⌖</span>
              {nearbyLocation}
              <span aria-hidden="true">⌄</span>
            </span>
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
        id="como-funciona"
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
    </main>
  );
}
