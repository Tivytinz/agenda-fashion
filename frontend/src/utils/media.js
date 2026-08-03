const API_ORIGIN = String(
  import.meta.env.VITE_API_URL || ""
)
  .replace(/\/+$/, "");

function secureUrl(url) {
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    url.protocol === "http:" &&
    !["localhost", "127.0.0.1"].includes(
      url.hostname
    )
  ) {
    url.protocol = "https:";
  }

  return url.toString();
}

export function resolveMediaUrl(value) {
  const source = String(value || "").trim();

  if (!source) {
    return "";
  }

  if (source.startsWith("//")) {
    return `https:${source}`;
  }

  try {
    if (/^https?:\/\//i.test(source)) {
      return secureUrl(new URL(source));
    }

    const origin = API_ORIGIN || (
      typeof window !== "undefined"
        ? window.location.origin
        : ""
    );

    if (!origin) {
      return source;
    }

    return new URL(
      source.replace(/^\/+/, ""),
      `${origin}/`
    ).toString();
  } catch {
    return source;
  }
}
