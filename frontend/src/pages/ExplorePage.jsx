import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { track } from "../analytics/track";
import { BusinessCard } from "../components/BusinessCard";
import { EmptyState, ErrorState, LoadingState } from "../components/ScreenState";
import { normalizeText } from "../utils/format";

const CATEGORIES = [
  ["", "Todos"],
  ["unha", "Unhas"],
  ["cabelo", "Cabelo"],
  ["cilio", "Cílios"],
  ["sobrancelha", "Sobrancelhas"]
];

export function ExplorePage() {
  const [businesses, setBusinesses] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  async function loadBusinesses() {
    setStatus("loading");

    try {
      const data = await apiRequest("/negocios-publicos");
      setBusinesses(Array.isArray(data.negocios) ? data.negocios : []);
      setStatus("ready");
    } catch (requestError) {
      setError(requestError.message);
      setStatus("error");
    }
  }

  useEffect(() => {
    void loadBusinesses();
    track("tela_visualizada", {
      page: "inicio",
      mission: "descobrir_servico"
    });
  }, []);

  const filtered = useMemo(() => {
    const wanted = normalizeText(`${query} ${category}`);

    if (!wanted) {
      return businesses;
    }

    const terms = wanted.split(/\s+/).filter(Boolean);

    return businesses.filter((business) => {
      const services = (business.servicos || [])
        .map((service) => `${service.nome} ${service.descricao || ""}`)
        .join(" ");
      const haystack = normalizeText([
        business.nome,
        business.setor,
        business.cidade,
        business.bairro,
        ...(business.areas || []),
        services
      ].join(" "));

      return terms.every((term) => haystack.includes(term));
    });
  }, [businesses, category, query]);

  function chooseCategory(value) {
    setCategory(value);
    track("categoria_selecionada", {
      page: "inicio",
      mission: "descobrir_servico",
      properties: { categoria: value || "todos" }
    });
  }

  return (
    <main>
      <section className="hero">
        <div className="container hero-content">
          <div className="hero-copy">
            <p className="eyebrow">Beleza perto de você</p>
            <h1>Seu próximo cuidado começa aqui</h1>
            <p>Encontre profissionais, compare serviços e escolha um horário em poucos passos.</p>
          </div>

          <div className="discovery-panel">
            <label className="search-box">
              <span className="search-icon" aria-hidden="true">⌕</span>
              <span className="sr-only">Buscar serviço, negócio ou cidade</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Serviço, negócio ou cidade"
              />
              {query && (
                <button
                  aria-label="Limpar busca"
                  className="clear-search"
                  onClick={() => setQuery("")}
                  type="button"
                >
                  ×
                </button>
              )}
            </label>

            <div className="chips" aria-label="Categorias">
              {CATEGORIES.map(([value, label]) => (
                <button
                  aria-pressed={category === value}
                  className={category === value ? "chip active" : "chip"}
                  key={label}
                  type="button"
                  onClick={() => chooseCategory(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container content-section" aria-labelledby="businesses-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Disponíveis agora</p>
            <h2 id="businesses-title">
              {query || category ? "Resultados para você" : "Negócios e profissionais"}
            </h2>
          </div>
          {status === "ready" && (
            <span>{filtered.length} {filtered.length === 1 ? "opção encontrada" : "opções encontradas"}</span>
          )}
        </div>

        {status === "loading" && <LoadingState>Buscando opções para você...</LoadingState>}
        {status === "error" && <ErrorState message={error} onRetry={loadBusinesses} />}
        {status === "ready" && filtered.length === 0 && (
          <EmptyState title="Nenhum resultado">
            Tente buscar outro serviço, negócio ou cidade.
          </EmptyState>
        )}
        {status === "ready" && filtered.length > 0 && (
          <div className="card-grid">
            {filtered.map((business) => (
              <BusinessCard business={business} key={business.id} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
