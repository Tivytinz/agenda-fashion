const DEFAULT_PUBLIC_ORIGIN =
  "https://app.agendafashion.com.br";

export const PUBLIC_LINK_MEDIA =
  Object.freeze({
    SHARE: "share",
    COPY: "copy",
    QR: "qr",
    WHATSAPP: "whatsapp",
  });

const PUBLIC_LINK_MEDIA_VALIDOS =
  new Set(
    Object.values(
      PUBLIC_LINK_MEDIA
    )
  );

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

function aplicarOrigemAf(
  url,
  acquisition
) {
  if (
    !acquisition ||
    typeof acquisition !== "object"
  ) {
    return;
  }

  const medium = String(
    acquisition.medium || ""
  )
    .trim()
    .toLowerCase();

  if (
    !PUBLIC_LINK_MEDIA_VALIDOS.has(
      medium
    )
  ) {
    return;
  }

  const content = String(
    acquisition.content || ""
  )
    .trim()
    .toLowerCase()
    .slice(0, 80);

  url.searchParams.set(
    "af_source",
    "agenda_fashion"
  );
  url.searchParams.set(
    "af_medium",
    medium
  );

  if (content) {
    url.searchParams.set(
      "af_content",
      content
    );
  }
}

export function buildPublicLink({
  businessSlug,
  serviceId,
  origin,
  acquisition
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

  aplicarOrigemAf(
    url,
    acquisition
  );

  return url.toString();
}

async function copyText(text) {
  if (!text) {
    throw new Error(
      "Conteúdo indisponível."
    );
  }

  if (
    navigator.clipboard?.writeText
  ) {
    await navigator.clipboard.writeText(
      text
    );
    return;
  }

  const input =
    document.createElement(
      "textarea"
    );

  input.value = text;
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
      "Não foi possível copiar o conteúdo."
    );
  }
}

export async function copyPublicLink(url) {
  if (!url) {
    throw new Error(
      "Link indisponível."
    );
  }

  await copyText(url);
}

export async function sharePublicLink({
  title,
  text,
  url,
  fallbackText
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

  const composedFallback = String(fallbackText || "").trim();
  if (composedFallback) {
    await copyText(composedFallback);
  } else {
    await copyPublicLink(url);
  }
  return "copied";
}
