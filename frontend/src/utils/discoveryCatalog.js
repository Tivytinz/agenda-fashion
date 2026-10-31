export const CATEGORY_SPOTLIGHTS = [
  ["unha", "Unhas", "Manicure e pedicure"],
  ["cabelo", "Cabelos", "Cortes e tratamentos"],
  ["estetica", "Estética", "Cuidados para você"],
  ["bronzeamento", "Bronzeamento", "Seu tom, seu momento"],
  ["cilio", "Cílios", "Realce seu olhar"],
  ["sobrancelha", "Sobrancelhas", "Design e expressão"],
  ["maquiagem", "Maquiagem", "Produções especiais"]
];

export const CATEGORY_CODES = new Set(
  CATEGORY_SPOTLIGHTS.map(([value]) => value)
);

export const LOCATION_STORAGE_KEY = "af_catalog_location";

const PAGE_SIZE = 12;

export function buildCatalogPath({
  query = "",
  category = "",
  city = "",
  state = "",
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

  if (city.trim()) {
    params.set("cidade", city.trim());
  }

  if (/^[A-Z]{2}$/.test(state.trim().toUpperCase())) {
    params.set("estado", state.trim().toUpperCase());
  }

  return `/negocios-publicos?${params.toString()}`;
}

export function locationKey(city, state) {
  const normalizedCity = String(city || "").trim();
  const normalizedState = String(state || "").trim().toUpperCase();

  if (!normalizedCity || !/^[A-Z]{2}$/.test(normalizedState)) {
    return "";
  }

  return `${normalizedCity}::${normalizedState}`;
}

export function parseLocationKey(value) {
  const key = String(value || "");
  const separator = key.lastIndexOf("::");

  if (separator < 1) {
    return { city: "", state: "" };
  }

  const city = key.slice(0, separator).trim();
  const state = key.slice(separator + 2).trim().toUpperCase();

  return /^[A-Z]{2}$/.test(state) && city
    ? { city, state }
    : { city: "", state: "" };
}

export function storedLocationKey() {
  try {
    return window.localStorage.getItem(LOCATION_STORAGE_KEY) || "";
  } catch {
    return "";
  }
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

