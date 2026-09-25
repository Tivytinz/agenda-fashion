const DOCUMENT_CACHE_CONTROL =
  "no-store, no-cache, must-revalidate";
const VERSIONED_ASSET_CACHE_CONTROL =
  "public, max-age=31536000, immutable";
const MUTABLE_PUBLIC_ASSET_CACHE_CONTROL =
  "public, max-age=0, must-revalidate";

const MUTABLE_PUBLIC_ASSETS =
  new Set([
    "assets/home/salon-hero-mobile.webp",
    "assets/home/salon-hero-wide.webp",
  ]);

function disableDocumentCache(response) {
  response.setHeader(
    "Cache-Control",
    DOCUMENT_CACHE_CONTROL
  );
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
}

function cacheVersionedAsset(response) {
  response.setHeader(
    "Cache-Control",
    VERSIONED_ASSET_CACHE_CONTROL
  );
}

function cacheMutablePublicAsset(response) {
  response.setHeader(
    "Cache-Control",
    MUTABLE_PUBLIC_ASSET_CACHE_CONTROL
  );
}

function cacheStaticAsset(
  response,
  relativePath
) {
  const caminho =
    String(
      relativePath ||
      ""
    )
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");

  if (
    MUTABLE_PUBLIC_ASSETS.has(
      caminho
    )
  ) {
    cacheMutablePublicAsset(
      response
    );
    return;
  }

  if (
    caminho.startsWith(
      "assets/"
    )
  ) {
    cacheVersionedAsset(
      response
    );
  }
}

module.exports = {
  cacheMutablePublicAsset,
  cacheStaticAsset,
  cacheVersionedAsset,
  disableDocumentCache
};
