export const BUSINESS_SPECIALTIES = Object.freeze([
  ["Unhas", "Unhas"],
  ["Cabelos", "Cabelos"],
  ["Cílios", "Cílios"],
  ["Sobrancelhas", "Sobrancelhas"],
  ["Maquiagem", "Maquiagem"],
  ["Estética", "Estética"],
  ["Bronzeamento", "Bronzeamento"],
  ["Outro", "Outro"]
]);

const CATEGORY_LABELS = Object.freeze({
  unha: "Unhas",
  cabelo: "Cabelos",
  cilio: "Cílios",
  sobrancelha: "Sobrancelhas",
  maquiagem: "Maquiagem",
  estetica: "Estética",
  bronzeamento: "Bronzeamento",
  outro: "Outro"
});

const CATEGORY_EMOJIS = Object.freeze({
  unha: "💅",
  cabelo: "💇",
  cilio: "👁️",
  sobrancelha: "〰️",
  maquiagem: "💄",
  estetica: "💆",
  bronzeamento: "☀️",
  outro: "✨"
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

export function serviceCategoryEmoji(value, serviceName = "") {
  const categoryKey = normalizeKey(value);

  if (CATEGORY_EMOJIS[categoryKey]) return CATEGORY_EMOJIS[categoryKey];

  if (/unha|manicure|pedicure|nail|esmalta/.test(categoryKey)) return "💅";
  if (/cabelo|cabeleir|barba|barbear/.test(categoryKey)) return "💇";
  if (/cilio|lash/.test(categoryKey)) return "👁️";
  if (/sobrancelha|brow|henna|micropigmenta/.test(categoryKey)) return "〰️";
  if (/maquiagem|makeup|make up/.test(categoryKey)) return "💄";
  if (/bronzeamento|bronze artificial|bronze natural|marquinha|spray tan/.test(categoryKey)) return "☀️";
  if (/estetica|pele|depil|massagem|drenagem|facial|corporal/.test(categoryKey)) return "💆";

  const nameKey = normalizeKey(serviceName);

  if (/unha|manicure|pedicure|nail|esmalta/.test(nameKey)) return "💅";
  if (/cabelo|cabeleir|corte|escova|penteado|barba/.test(nameKey)) return "💇";
  if (/cilio|lash/.test(nameKey)) return "👁️";
  if (/sobrancelha|brow|henna|micropigmenta/.test(nameKey)) return "〰️";
  if (/maquiagem|makeup|make up/.test(nameKey)) return "💄";
  if (/bronzeamento|bronze artificial|bronze natural|marquinha|spray tan/.test(nameKey)) return "☀️";
  if (/estetica|pele|depil|massagem|drenagem|facial|corporal/.test(nameKey)) return "💆";

  return "✨";
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
    else if (/bronzeamento|bronze artificial|bronze natural|marquinha|spray tan/.test(key)) found.add("Bronzeamento");
    else if (/estetica|pele|depil|massagem|drenagem|facial|corporal/.test(key)) found.add("Estética");
    else if (key) found.add("Outro");
  });

  return BUSINESS_SPECIALTIES
    .map(([value]) => value)
    .filter((value) => found.has(value));
}
