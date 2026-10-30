import { useEffect, useState } from "react";

export function DiscoveryLocationFilter({ value, options, status, onChange, onRetry, id, query = "", onSearch }) {
  const [draftQuery, setDraftQuery] = useState(query);
  useEffect(() => setDraftQuery(query), [query]);
  return (
    <section aria-label="Filtros de descoberta" aria-busy={status === "loading"}
      className="container home-discovery-filters" id={id}>
      <form className="home-discovery-search" role="search" aria-label="Buscar serviços na cidade"
        onSubmit={(event) => { event.preventDefault(); onSearch(draftQuery.trim()); }}>
        <label className="home-service-search">
          <span>Qual serviço?</span>
          <input type="search" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Serviço ou profissional" />
        </label>
      <label className="home-location-pill">
        <span aria-hidden="true">📍</span>
        <span>Cidade</span>
        <select aria-label="Escolher localização" value={value}
          disabled={status !== "ready"} onChange={(event) => onChange(event.target.value)}>
          <option value="">{status === "loading" ? "Carregando cidades…" : "Todo o Brasil"}</option>
          {options.map(([key, location]) => (
            <option key={key} value={key}>{location.cidade}, {location.estado}</option>
          ))}
        </select>
      </label>
      <button className="button" type="submit">Buscar</button>
      </form>
      {status === "loading" && <span className="sr-only" role="status">Carregando cidades…</span>}
      {status === "error" && (
        <span role="alert">Não foi possível atualizar as cidades. <button type="button"
          className="text-button" onClick={() => onRetry()}>Tentar carregar cidades novamente</button></span>
      )}
    </section>
  );
}
