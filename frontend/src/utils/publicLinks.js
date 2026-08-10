const DEFAULT_PUBLIC_ORIGIN =
  "https://app.agendafashion.com.br";

function resolveOrigin(origin) {
  const value = String(
    origin ||
    import.meta.env.VITE_PUBLIC_APP_URL ||
    DEFAULT_PUBLIC_ORIGIN
  ).trim();

  if (!value) {
    throw new Error(
      "Não foi possível identificar o endereço do Agenda Fashion."
    );
  }

  const url = new URL(value);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(
      "O endereço público do Agenda Fashion é inválido."
    );
  }

  return url.origin;
}

export function buildPublicLink({
  businessSlug,
  serviceId,
  origin
}) {
  const slug = String(
    businessSlug || ""
  ).trim();

  if (!slug) {
    return "";
  }

  const url = new URL(
    `/negocio/${encodeURIComponent(slug)}`,
    resolveOrigin(origin)
  );

  if (
    serviceId !== undefined &&
    serviceId !== null &&
    String(serviceId).trim()
  ) {
    url.searchParams.set(
      "servico",
      String(serviceId)
    );
  }

  return url.toString();
}

export async function copyPublicLink(url) {
  if (!url) {
    throw new Error(
      "Link indisponível."
    );
  }

  if (
    navigator.clipboard?.writeText
  ) {
    await navigator.clipboard.writeText(
      url
    );
    return;
  }

  const input =
    document.createElement(
      "textarea"
    );

  input.value = url;
  input.setAttribute(
    "readonly",
    ""
  );
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(
    input
  );
  input.select();

  const copied =
    document.execCommand(
      "copy"
    );

  input.remove();

  if (!copied) {
    throw new Error(
      "Não foi possível copiar o link."
    );
  }
}

export async function sharePublicLink({
  title,
  text,
  url
}) {
  if (
    typeof navigator.share ===
    "function"
  ) {
    try {
      await navigator.share({
        title,
        text,
        url
      });

      return "shared";
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        return "cancelled";
      }
    }
  }

  await copyPublicLink(url);
  return "copied";
}
