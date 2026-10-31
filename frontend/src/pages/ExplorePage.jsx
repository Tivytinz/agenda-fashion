import { useEffect } from "react";
import { HomeHero } from "../components/HomeHero";
import { BusinessCard } from "../components/BusinessCard";
import { ServiceCard } from "../components/ServiceCard";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import { DiscoverySearch } from "../components/discovery/DiscoverySearch";
import { CategorySpotlightCard } from "../components/discovery/CategorySpotlightCard";
import { HorizontalRail } from "../components/discovery/HorizontalRail";
import { CATEGORY_SPOTLIGHTS } from "../utils/discoveryCatalog";
import { serviceCategoryLabel } from "../utils/specialties";
import { useDiscoveryCatalog } from "../hooks/useDiscoveryCatalog";
export { buildCatalogPath, diversifyServices } from "../utils/discoveryCatalog";

export function ExplorePage({ controller, renderHero = true, onMounted }) {
  return controller
    ? <ExploreContent controller={controller} onMounted={onMounted} />
    : <StandaloneExplore renderHero={renderHero} onMounted={onMounted} />;
}

function StandaloneExplore({ renderHero, onMounted }) {
  const controller = useDiscoveryCatalog();
  useEffect(() => {
    if (controller.location.hash !== "#buscar-servicos") return undefined;
    const frame = window.requestAnimationFrame(() => document.getElementById("buscar-servicos")?.scrollIntoView?.({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [controller.location.key, controller.location.hash]);
  return <div className="home-page">
    <DiscoverySearch controller={controller} id="buscar-servicos" />
    {renderHero && <HomeHero onExploreCategory={controller.exploreHeroCategory} />}
    <ExploreContent controller={controller} onMounted={onMounted} />
  </div>;
}

function ExploreContent({ controller, onMounted }) {
  useEffect(() => {
    onMounted?.(true);
    return () => onMounted?.(false);
  }, [onMounted]);
  const { status, query, category, selectedLocationKey, selectedLocation,
    sortedBusinesses, filteredServices, hasMore, loadingMore, error,
    loadBusinesses, loadMore, chooseCategory, removeFilter, clearFilters } = controller;

  const businessSection = (status === "ready" && (
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
                  : "Espaços e profissionais"}
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
                    compact
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


        </section>
      ));

  return (
    <div className="home-discovery-content">
        {(query || category || selectedLocationKey) && (
          <div className="container home-active-filters home-results-filters" role="region" aria-label="Filtros aplicados">
            {selectedLocationKey && <button className="home-filter-chip" type="button" onClick={() => removeFilter(["cidade", "estado"])} aria-label="Remover filtro de cidade">Cidade: <strong>{selectedLocation.city}, {selectedLocation.state}</strong> ×</button>}
            {query && <button className="home-filter-chip" type="button" onClick={() => removeFilter(["busca"])} aria-label="Remover filtro de busca">Busca: <strong>{query}</strong> ×</button>}
            {category && <span>Categoria: <strong>{serviceCategoryLabel(category)}</strong></span>}
            <button className="text-button" onClick={clearFilters} type="button">Limpar filtros</button>
          </div>
        )}

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

      <section
        aria-labelledby="services-title"
        className="container content-section home-catalog-section"
        id="servicos"
      >
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">
              Encontre seu próximo cuidado
            </p>

            <h2 id="services-title">
              {query || category
                ? "Serviços encontrados"
                : "Explorar serviços"}
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
              Tente outro serviço ou cidade.
              {category && <button className="text-button" type="button" onClick={() => chooseCategory("")}>Buscar em todas as categorias</button>}
            </EmptyState>
          )}

        {status === "ready" &&
          filteredServices.length >
          0 && (
            <>
              <p className="home-result-count" role="status">
                {filteredServices.length} {filteredServices.length === 1 ? "serviço exibido" : "serviços exibidos"}{hasMore ? " · Carregue mais resultados para continuar explorando." : ""}
              </p>
              <div className="home-services-grid">
                {filteredServices.map((service) => (
                  <ServiceCard service={service} compact key={`${service.negocio_id}-${service.id}`} />
                ))}
              </div>
            </>
          )}
      </section>

      {businessSection}
      {status === "ready" && (
        <div className="container home-pagination" aria-label="Mais resultados do catálogo">
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
                  : "Carregar mais resultados"}
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
        </div>
      )}

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
