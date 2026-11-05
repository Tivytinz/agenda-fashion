const MAX_PG_ID = "9223372036854775807";

function validId(value) {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0;
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) return false;
  return value.length < MAX_PG_ID.length ||
    (value.length === MAX_PG_ID.length && value <= MAX_PG_ID);
}
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function optionalTextFields(value, keys) {
  return keys.every((key) => value[key] == null || typeof value[key] === "string");
}
export function parsePublicCatalogResponse(data) {
  const invalid = () => { throw new Error("Não foi possível ler o catálogo. Tente atualizar novamente."); };
  if (!record(data)) invalid();
  const businesses = data.negocios ?? [];
  if (!Array.isArray(businesses) || !businesses.every((business) =>
    record(business) && validId(business.id) &&
    optionalTextFields(business, ["nome", "slug", "cidade", "estado", "bairro", "descricao", "foto_url"]) &&
    (business.areas == null || (Array.isArray(business.areas) && business.areas.every((area) => typeof area === "string"))) &&
    (business.servicos == null || (Array.isArray(business.servicos) && business.servicos.every((service) =>
      record(service) && validId(service.id) &&
      optionalTextFields(service, ["nome", "descricao", "categoria", "foto_url"])
    )))
  )) invalid();
  if (data.localidades != null && (!Array.isArray(data.localidades) ||
    !data.localidades.every((item) => record(item) &&
      typeof item.cidade === "string" && typeof item.estado === "string"))) invalid();
  if (data.paginacao != null && (!record(data.paginacao) ||
    (data.paginacao.tem_mais != null && typeof data.paginacao.tem_mais !== "boolean"))) invalid();
  return { ...data, negocios: businesses };
}
