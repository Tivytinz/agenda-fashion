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

function optimizeCloudinary(url, width, fit) {
  if (
    !width ||
    url.hostname !== "res.cloudinary.com" ||
    !url.pathname.includes("/image/upload/")
  ) {
    return url;
  }

  url.pathname = url.pathname.replace(
    "/image/upload/",
    `/image/upload/f_auto,q_auto,${fit === "contain" ? "c_fit" : "c_fill"},w_${Math.max(80, Math.round(width))}/`
  );
  return url;
}

export function resolveMediaUrl(value, { width, fit = "cover" } = {}) {
  const source = String(value || "").trim();

  if (!source) {
    return "";
  }

  if (source.startsWith("//")) {
    return `https:${source}`;
  }

  try {
    if (/^https?:\/\//i.test(source)) {
      return secureUrl(optimizeCloudinary(new URL(source), width, fit));
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

export function withMediaRetry(value, retry = 0) {
  if (!value || retry < 1) return value;

  try {
    const url = new URL(value, typeof window !== "undefined" ? window.location.origin : undefined);
    url.searchParams.set("af_retry", String(retry));
    return url.toString();
  } catch {
    return value;
  }
}
