import { useEffect, useState } from "react";

export function DiscoveryLocationFilter({ value, options, status, locationsReady, onRetry, id, query = "", onSearch, categoryLabel, onClearCategory, resetKey }) {
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftLocation, setDraftLocation] = useState(value);
  useEffect(() => {
    setDraftQuery(query);
    setDraftLocation(value);
  }, [query, value, resetKey]);
  return (
    <section aria-label="Filtros de descoberta" aria-busy={status === "loading"}
      className="container home-discovery-filters" id={id}>
      <form className="home-discovery-search" role="search" aria-label="Buscar serviços na cidade"
        onSubmit={(event) => { event.preventDefault(); onSearch(draftQuery.trim(), draftLocation); }}>
        <label className="home-service-search">
          <span>Qual serviço?</span>
          <input type="search" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Serviço ou negócio" />
        </label>
        <label className="home-location-pill">
          <span aria-hidden="true">📍</span>
          <span>Cidade</span>
          <select aria-label="Escolher localização" value={draftLocation}
            disabled={!locationsReady && options.length === 0} onChange={(event) => setDraftLocation(event.target.value)}>
            <option value="">{!locationsReady && status === "loading" ? "Carregando cidades…" : "Todo o Brasil"}</option>
            {options.map(([key, location]) => (
              <option key={key} value={key}>{location.cidade}, {location.estado}</option>
            ))}
          </select>
        </label>
        <button className="button" type="submit">Buscar</button>
      </form>
      {!value && <p className="home-search-scope">Busca em todo o Brasil. Escolha uma cidade para encontrar atendimento na região.</p>}
      {categoryLabel && <button className="home-filter-chip" type="button" onClick={onClearCategory}
        aria-label={`Remover categoria ${categoryLabel}`}>Categoria: {categoryLabel} <span aria-hidden="true">×</span></button>}
      {status === "loading" && <span className="sr-only" role="status">Buscando resultados…</span>}
      {status === "error" && (
        <span role="alert">Não foi possível atualizar o catálogo. <button type="button"
          className="text-button" onClick={() => onRetry()}>Tentar atualizar catálogo</button></span>
      )}
    </section>
  );
}
