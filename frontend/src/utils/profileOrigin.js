export const PROFILE_ORIGIN = Object.freeze({
  HOME: "inicio",
  SEARCH: "busca",
  FAVORITES: "favoritos",
  APPOINTMENTS: "meus_agendamentos",
  SHARE: "compartilhamento"
});

const PROFILE_ORIGINS = new Set(
  Object.values(PROFILE_ORIGIN)
);

const SHARE_MEDIA = new Set([
  "share",
  "copy",
  "qr",
  "whatsapp"
]);

export function normalizeProfileOrigin(value) {
  const origin = String(value || "")
    .trim()
    .toLowerCase();

  return PROFILE_ORIGINS.has(origin)
    ? origin
    : "nao_informada";
}

export function resolveProfileOrigin(searchParams) {
  const params = searchParams instanceof URLSearchParams
    ? searchParams
    : new URLSearchParams(String(searchParams || ""));

  const explicit = normalizeProfileOrigin(
    params.get("origem")
  );

  if (explicit !== "nao_informada") {
    return explicit;
  }

  const afSource = String(params.get("af_source") || "")
    .trim()
    .toLowerCase();
  const afMedium = String(params.get("af_medium") || "")
    .trim()
    .toLowerCase();

  if (
    afSource === "agenda_fashion" &&
    SHARE_MEDIA.has(afMedium)
  ) {
    return PROFILE_ORIGIN.SHARE;
  }

  return "nao_informada";
}

export function resolveDiscoveryProfileOrigin(pathname, search) {
  const path = String(pathname || "");
  const params = new URLSearchParams(String(search || ""));

  if (
    path.startsWith("/servicos/") ||
    String(params.get("busca") || "").trim()
  ) {
    return PROFILE_ORIGIN.SEARCH;
  }

  if (path === "/") {
    return PROFILE_ORIGIN.HOME;
  }

  return "nao_informada";
}

export function buildProfilePath({
  slug,
  serviceId,
  professionalId,
  origin
} = {}) {
  const normalizedSlug = String(slug || "").trim();

  if (!normalizedSlug) {
    return "";
  }

  const params = new URLSearchParams();

  if (
    serviceId !== undefined &&
    serviceId !== null &&
    String(serviceId).trim()
  ) {
    params.set("servico", String(serviceId));
  }

  if (
    professionalId !== undefined &&
    professionalId !== null &&
    String(professionalId).trim()
  ) {
    params.set("profissional", String(professionalId));
  }

  const normalizedOrigin = normalizeProfileOrigin(origin);
  if (normalizedOrigin !== "nao_informada") {
    params.set("origem", normalizedOrigin);
  }

  const query = params.toString();
  const path = `/negocio/${encodeURIComponent(normalizedSlug)}`;

  return query ? `${path}?${query}` : path;
}

export function mergeProfileSearchParams(current, updates = {}) {
  const params = current instanceof URLSearchParams
    ? new URLSearchParams(current)
    : new URLSearchParams(String(current || ""));

  Object.entries(updates).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    ) {
      params.delete(key);
      return;
    }

    params.set(key, String(value));
  });

  return params;
}
