export function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value) || 0);
}

export function formatWhatsApp(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);

  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;

  const areaCode = digits.slice(0, 2);
  const localNumber = digits.slice(2);

  if (localNumber.length <= 5) {
    return `(${areaCode}) ${localNumber}`;
  }

  return `(${areaCode}) ${localNumber.slice(0, -4)}-${localNumber.slice(-4)}`;
}

export function formatLocation(business) {
  const parts = [business?.bairro, business?.cidade, business?.estado]
    .map((part) => String(part || "").replace(/\s+/g, " ").trim())
    .filter((part) => part && !["null", "undefined"].includes(part.toLowerCase()));

  const uniqueParts = parts.filter(
    (part, index) => parts.findIndex(
      (candidate) => normalizeText(candidate) === normalizeText(part)
    ) === index
  );

  return uniqueParts.join(", ") || "Localização não informada";
}

export function formatDate(value, long = false) {
  const date = new Date(`${value}T12:00:00`);

  return new Intl.DateTimeFormat("pt-BR", long
    ? { weekday: "long", day: "2-digit", month: "long" }
    : { weekday: "short", day: "2-digit", month: "short" }
  ).format(date);
}

export function formatRating(business) {
  const reviews = Number(business?.total_avaliacoes || 0);

  if (reviews <= 0) {
    return {
      label: "Novo",
      ariaLabel: "Negócio novo, ainda sem avaliações"
    };
  }

  const rating = Number(business?.media_avaliacoes || 0);

  return {
    label: `★ ${rating.toFixed(1)}`,
    ariaLabel: `${rating.toFixed(1)} de 5, ${reviews} ${
      reviews === 1 ? "avaliação" : "avaliações"
    }`
  };
}

export function normalizeAvailability(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const byDate = new Map();

  items.forEach((item) => {
    const date = String(item?.data || "").trim();
    const times = Array.isArray(item?.horarios)
      ? [...new Set(
        item.horarios
          .map((time) => String(time || "").slice(0, 5))
          .filter((time) => /^\d{2}:\d{2}$/.test(time))
      )].sort()
      : [];

    if (!date || times.length === 0) {
      return;
    }

    const current = byDate.get(date) || [];
    byDate.set(date, [...new Set([...current, ...times])].sort());
  });

  return [...byDate]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([data, horarios]) => ({ data, horarios }));
}
