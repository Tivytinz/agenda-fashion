import { useEffect, useMemo } from "react";
import { track } from "../analytics/trackEvent";
import { normalizeText } from "../utils/format";
import { diversifyServices, locationKey } from "../utils/discoveryCatalog";
import { useCatalogFilters } from "./useCatalogFilters";
import { usePublicCatalog } from "./usePublicCatalog";

export function useDiscoveryCatalog({ enabled = true } = {}) {
  const filters = useCatalogFilters();
  const catalog = usePublicCatalog({ query: filters.query, category: filters.category,
    city: filters.selectedLocation.city, state: filters.selectedLocation.state,
    enabled: enabled && filters.locationRestored });
  const { businesses, locations } = catalog;
  const { query, selectedLocation, selectedLocationKey } = filters;
  useEffect(() => {
    if (enabled) track("tela_visualizada", { page: "inicio", mission: "descobrir_servico" });
  }, [enabled]);
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

  return { ...filters, ...catalog, filteredServices, locationOptions, sortedBusinesses };
}
