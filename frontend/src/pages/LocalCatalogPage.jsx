import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Link, useParams } from "react-router-dom";

import { apiRequest } from "../api/client";
import { track } from "../analytics/track";
import { BusinessCard } from "../components/BusinessCard";
import { ServiceCard } from "../components/ServiceCard";
import {
  EmptyState,
  ErrorState,
  LoadingState
} from "../components/ScreenState";
import { usePageMetadata } from "../hooks/usePageMetadata";

import "../styles/local-catalog.css";

const PAGE_SIZE = 12;

export function buildLocalCatalogApiPath({
  categoria,
  localidade,
  page = 1
}) {
  const params = new URLSearchParams({
    pagina: String(page),
    limite: String(PAGE_SIZE)
  });

  return `/catalogo-local/${encodeURIComponent(
    categoria
  )}/${encodeURIComponent(
    localidade
  )}?${params.toString()}`;
}

function flattenServices(businesses) {
  return businesses.flatMap((business) =>
    (business.servicos || []).map((service) => ({
      ...service,
      negocio_id: business.id,
      negocio_nome: business.nome,
      negocio_slug: business.slug,
      negocio_setor: business.setor,
      negocio_cidade: business.cidade,
      negocio_bairro: business.bairro,
      negocio_estado: business.estado,
      negocio_foto_url: business.foto_url
    }))
  );
}

export function LocalCatalogPage() {
  const { categoria = "", localidade = "" } = useParams();
  const [businesses, setBusinesses] = useState([]);
  const [filter, setFilter] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const trackedPage = useRef("");

  const loadCatalog = useCallback(async ({
    requestedPage = 1,
    append = false,
    signal
  } = {}) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setStatus("loading");
      setError("");
    }

    try {
      const data = await apiRequest(
        buildLocalCatalogApiPath({
          categoria,
          localidade,
          page: requestedPage
        }),
        { signal }
      );

      const received = Array.isArray(data.negocios)
        ? data.negocios
        : [];

      setBusinesses((current) =>
        append
          ? [...current, ...received]
          : received
      );
      setFilter(data.filtro || null);
      setMetadata(data.metadados || null);
      setPage(requestedPage);
      setHasMore(Boolean(data.paginacao?.tem_mais));
      setError("");
      setStatus("ready");
    } catch (requestError) {
      if (signal?.aborted) return;

      setError(requestError.message);
      setStatus(
        requestError.status === 404
          ? "not-found"
          : "error"
      );
    } finally {
      if (!signal?.aborted) {
        setLoadingMore(false);
      }
    }
  }, [categoria, localidade]);

  useEffect(() => {
    const controller = new AbortController();

    setBusinesses([]);
    setFilter(null);
    setMetadata(null);
    setPage(1);
    setHasMore(false);

    void loadCatalog({
      requestedPage: 1,
      signal: controller.signal
    });

    return () => controller.abort();
  }, [loadCatalog]);

  useEffect(() => {
    if (!filter) return;

    const key = `${filter.categoria_slug}:${filter.localidade_slug}`;

    if (trackedPage.current === key) return;
    trackedPage.current = key;

    track("catalogo_local_visualizado", {
      page: "catalogo_local",
      mission: "descobrir_servico",
      properties: {
        categoria: filter.categoria,
        categoria_slug: filter.categoria_slug,
        cidade: filter.cidade,
        estado: filter.estado
      }
    });
  }, [filter]);

  const notFound = status === "not-found";

  usePageMetadata(
    metadata?.titulo || (
      notFound
        ? "Serviços não encontrados | Agenda Fashion"
        : "Serviços perto de você | Agenda Fashion"
    ),
    metadata?.descricao ||
      "Encontre profissionais e serviços de beleza e agende online pelo Agenda Fashion."
  );

  const services = useMemo(
    () => flattenServices(businesses),
    [businesses]
  );

  async function loadMore() {
    await loadCatalog({
      requestedPage: page + 1,
      append: true
    });
  }

  if (status === "loading") {
    return (
      <main className="container page-content">
        <LoadingState>
          Buscando profissionais e serviços na região...
        </LoadingState>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="container page-content">
        <ErrorState
          message={error}
          onRetry={() => loadCatalog({ requestedPage: 1 })}
        />
      </main>
    );
  }

  if (status === "not-found") {
    return (
      <main className="container page-content local-catalog-empty">
        <EmptyState title="Ainda não há serviços para esta busca">
          <p>
            Essa combinação de categoria e localidade ainda não possui
            negócios publicados no Agenda Fashion.
          </p>
          <Link className="button" to="/">
            Explorar outros serviços
          </Link>
        </EmptyState>
      </main>
    );
  }

  return (
    <main>
      <section className="local-catalog-hero">
        <div className="container local-catalog-hero-content">
          <nav
            aria-label="Navegação estrutural"
            className="local-breadcrumb"
          >
            <Link to="/">Início</Link>
            <span aria-hidden="true">›</span>
            <span>Serviços</span>
            <span aria-hidden="true">›</span>
            <span aria-current="page">
              {filter?.cidade}
            </span>
          </nav>

          <p className="eyebrow">Beleza perto de você</p>
          <h1>
            {filter?.titulo} em {filter?.cidade} - {filter?.estado}
          </h1>
          <p>
            Compare profissionais, serviços e preços disponíveis em
            {" "}{filter?.cidade} e escolha onde agendar.
          </p>

          <div className="local-result-summary">
            <strong>{businesses.length}</strong>
            <span>
              {businesses.length === 1
                ? "negócio carregado"
                : "negócios carregados"}
            </span>
          </div>
        </div>
      </section>

      <section
        className="container content-section"
        aria-labelledby="local-services-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Serviços disponíveis</p>
            <h2 id="local-services-title">
              Agende {filter?.descricao}
            </h2>
          </div>
        </div>

        {services.length > 0 ? (
          <div className="service-discovery-grid">
            {services.map((service) => (
              <ServiceCard
                service={service}
                key={`${service.negocio_id}-${service.id}`}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhum serviço disponível">
            Os negócios desta página ainda não possuem serviços ativos
            nessa categoria.
          </EmptyState>
        )}
      </section>

      <section
        className="container content-section businesses-section"
        aria-labelledby="local-businesses-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Profissionais e negócios</p>
            <h2 id="local-businesses-title">
              Onde agendar em {filter?.cidade}
            </h2>
          </div>
        </div>

        <div className="card-grid">
          {businesses.map((business) => (
            <BusinessCard
              business={business}
              key={business.id}
            />
          ))}
        </div>

        {hasMore && (
          <div className="load-more-row local-load-more">
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
      </section>
    </main>
  );
}
