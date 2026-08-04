export const BUSINESS_SPECIALTIES = Object.freeze([
  ["Unhas", "Unhas"],
  ["Cabelos", "Cabelos"],
  ["Cílios", "Cílios"],
  ["Sobrancelhas", "Sobrancelhas"],
  ["Maquiagem", "Maquiagem"],
  ["Estética", "Estética"],
  ["Outro", "Outro"]
]);

const CATEGORY_LABELS = Object.freeze({
  unha: "Unhas",
  cabelo: "Cabelos",
  cilio: "Cílios",
  sobrancelha: "Sobrancelhas",
  maquiagem: "Maquiagem",
  estetica: "Estética",
  outro: "Outro"
});

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function serviceCategoryLabel(value) {
  return CATEGORY_LABELS[normalizeKey(value)] || "Serviço de beleza";
}

export function normalizeBusinessSpecialties(business = {}) {
  const received = Array.isArray(business.areas)
    ? business.areas
    : Array.isArray(business.especialidades)
      ? business.especialidades
      : [];
  const source = received.length > 0 ? received : [business.setor].filter(Boolean);
  const found = new Set();

  source.forEach((value) => {
    const key = normalizeKey(value);

    if (/unha|manicure|pedicure|nail|esmalta/.test(key)) found.add("Unhas");
    else if (/cabelo|cabeleir|barba|barbear/.test(key)) found.add("Cabelos");
    else if (/cilio|lash/.test(key)) found.add("Cílios");
    else if (/sobrancelha|brow|henna|micropigmenta/.test(key)) found.add("Sobrancelhas");
    else if (/maquiagem|makeup|make up/.test(key)) found.add("Maquiagem");
    else if (/estetica|pele|depil|massagem|drenagem|facial|corporal/.test(key)) found.add("Estética");
    else if (key) found.add("Outro");
  });

  return BUSINESS_SPECIALTIES
    .map(([value]) => value)
    .filter((value) => found.has(value));
}
