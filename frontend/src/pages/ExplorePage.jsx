import {
  useEffect,
  useMemo,
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

  async function loadBusinesses() {
    setStatus("loading");

    try {
      const data = await apiRequest("/negocios-publicos");

      setBusinesses(
        Array.isArray(data.negocios)
          ? data.negocios
          : []
      );

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
      const wanted =
        normalizeText(
          `${query} ${category}`
        );

      if (!wanted) {
        return services;
      }

      const terms =
        wanted
          .split(/\s+/)
          .filter(Boolean);

      return services.filter(
        (service) => {
          const haystack =
            normalizeText(
              [
                service.nome,
                service.descricao,
                service.categoria,
                service.negocio_nome,
                service.negocio_setor,
                service.negocio_cidade,
                service.negocio_bairro
              ].join(" ")
            );

          return terms.every(
            (term) =>
              haystack.includes(term)
          );
        }
      );
    }, [
      services,
      category,
      query
    ]);

  const filteredBusinesses =
    useMemo(() => {
      const wanted =
        normalizeText(
          `${query} ${category}`
        );

      if (!wanted) {
        return businesses;
      }

      const terms =
        wanted
          .split(/\s+/)
          .filter(Boolean);

      return businesses.filter(
        (business) => {
          const businessServices =
            (
              business.servicos || []
            )
              .map(
                (service) =>
                  `${service.nome} ${service.descricao || ""
                  }`
              )
              .join(" ");

          const haystack =
            normalizeText(
              [
                business.nome,
                business.setor,
                business.cidade,
                business.bairro,
                ...(business.areas || []),
                businessServices
              ].join(" ")
            );

          return terms.every(
            (term) =>
              haystack.includes(term)
          );
        }
      );
    }, [
      businesses,
      category,
      query
    ]);

  const sortedBusinesses =
    useMemo(() => {
      return [...filteredBusinesses].sort(
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
    }, [filteredBusinesses]);

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
                ? "serviço encontrado"
                : "serviços encontrados"}
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

      {status === "ready" &&
        sortedBusinesses.length >
        0 && (
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
                {
                  sortedBusinesses.length
                }{" "}
                {sortedBusinesses.length ===
                  1
                  ? "opção encontrada"
                  : "opções encontradas"}
              </span>
            </div>

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
          </section>
        )}
    </main>
  );
}