import { formatCep, formatWhatsApp } from "../../utils/format";
import { normalizeBusinessSpecialties } from "../../utils/specialties";
import BUSINESS_TIME_ZONES from "../../../../src/config/businessTimeZones.json";

export { BUSINESS_TIME_ZONES };
export function timeZonesForState(estado) {
  return BUSINESS_TIME_ZONES[String(estado || "").toUpperCase()] || [];
}

// Link de busca, não geocodificação certificada: a profissional deve conferir.
export function buildBusinessMapSearchUrl(form) {
  const address = [form.endereco, form.numero, form.bairro, form.cidade, form.estado, "Brasil"]
    .map(value => String(value || "").trim());
  if (address.slice(0, 5).some(value => !value)) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.join(", "))}`;
}

export const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export const EMPTY = {
  nome: "",
  descricao: "",
  whatsapp: "",
  cidade: "",
  estado: "",
  bairro: "",
  endereco: "",
  numero: "",
  complemento: "",
  cep: "",
  localizacao_url: "",
  fuso_horario: "",
  foto_url: "",
  slug: "",
  areas: []
};

const CREATION_REQUIRED_FIELDS = [
  ["nome", "Nome do negócio"],
  ["whatsapp", "WhatsApp"],
  ["cidade", "Cidade"],
  ["estado", "Estado"],
  ["bairro", "Bairro"],
  ["endereco", "Endereço"],
  ["numero", "Número"],
  ["cep", "CEP"],
  ["localizacao_url", "Link da localização"]
];

export function validateImage(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Use uma imagem JPG, PNG ou WEBP.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "A imagem deve ter no máximo 5 MB.";
  }

  return "";
}

export function normalizeBusinessForm(business = {}) {
  return {
    ...EMPTY,
    ...business,
    whatsapp: formatWhatsApp(
      business.whatsapp || business.whatsapp_negocio
    ),
    cep: formatCep(business.cep),
    areas: normalizeBusinessSpecialties(business)
  };
}

export function serializeBusinessForm(value) {
  return JSON.stringify({
    ...value,
    areas: [...(value.areas || [])].sort()
  });
}

export function isValidLocationUrl(value) {
  if (!String(value || "").trim()) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isBusinessMapUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return ["maps.google.com", "maps.google.com.br", "maps.app.goo.gl", "maps.apple.com"]
      .includes(host) ||
      (["www.google.com", "www.google.com.br", "google.com", "google.com.br"]
        .includes(host) && /^\/maps(?:\/|$)/.test(url.pathname));
  } catch {
    return false;
  }
}

export function validateWhatsApp(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 || digits.length === 11
    ? ""
    : "Informe um WhatsApp com DDD e 10 ou 11 dígitos.";
}

export function firstMissingBusinessField(form) {
  if (!Array.isArray(form.areas) || form.areas.length === 0) return "areas";
  for (const [field] of CREATION_REQUIRED_FIELDS) {
    if (!String(form[field] ?? "").trim()) return field;
  }
  if (timeZonesForState(form.estado).length > 1 && !form.fuso_horario) return "fuso_horario";
  return "";
}

export function validateCreationCompleteness(form) {
  const missing = firstMissingBusinessField(form);
  if (!missing) return "";
  const labels = Object.fromEntries(CREATION_REQUIRED_FIELDS.map(([field, label]) => [field, label]));
  labels.areas = "Especialidades";
  labels.fuso_horario = "Fuso horário";
  return `Preencha todas as informações do negócio antes de continuar. Campo pendente: ${labels[missing]}.`;
}
