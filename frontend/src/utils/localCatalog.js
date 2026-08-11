import catalogLocal from "../../../src/config/catalogLocal.json";

const CATEGORY_SLUG_BY_CODE = new Map(
  Object.entries(catalogLocal).map(
    ([slug, config]) => [config.categoria, slug]
  )
);

export function slugifyLocalPart(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildLocalCatalogPath({
  category,
  city,
  state
}) {
  const categorySlug = CATEGORY_SLUG_BY_CODE.get(category);
  const citySlug = slugifyLocalPart(city);
  const normalizedState = String(state || "")
    .trim()
    .toLowerCase();

  if (
    !categorySlug ||
    !citySlug ||
    !/^[a-z]{2}$/.test(normalizedState)
  ) {
    return null;
  }

  return `/servicos/${categorySlug}/em/${citySlug}-${normalizedState}`;
}
