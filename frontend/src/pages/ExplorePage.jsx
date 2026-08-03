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

const CATEGORIES = [
  ["", "Todos"],
  ["unha", "Unhas"],
  ["cabelo", "Cabelo"],
  ["cilio", "Cílios"],
  ["sobrancelha", "Sobrancelhas"],
  ["maquiagem", "Maquiagem"],
  ["estetica", "Estética"]
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

  const [total, setTotal] =
    useState(0);

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
      setTotal(
        Number(data.paginacao?.total) ||
          received.length
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

            negocio_foto_url:
              business.foto_url
          }));
        }
      );
    }, [businesses]);

  const filteredServices =
    useMemo(() => {
      const wanted = normalizeText(query);

      if (!wanted) {
        return services;
      }

      const terms = wanted
        .split(/\s+/)
        .filter(Boolean);

      return services.filter((service) => {
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

        return terms.every((term) =>
          haystack.includes(term)
        );
      });
    }, [services, query]);

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
    <main>
      <section className="hero">
        <div className="container hero-content">
          <div className="hero-copy">
            <p className="eyebrow">
              Beleza perto de você
            </p>

            <h1>
              Encontre o serviço que combina com você
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

          {status === "ready" && (
            <span>
              {filteredServices.length}{" "}
              {filteredServices.length ===
                1
                ? "serviço exibido"
                : "serviços exibidos"}
            </span>
          )}
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
            <div className="service-discovery-grid">
              {filteredServices.map(
                (service) => (
                  <ServiceCard
                    service={service}
                    key={`${service.negocio_id}-${service.id}`}
                  />
                )
              )}
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

              <span>
                {total}{" "}
                {total ===
                  1
                  ? "opção encontrada"
                  : "opções encontradas"}
              </span>
            </div>

            {sortedBusinesses.length > 0 ? (
              <div className="card-grid">
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
