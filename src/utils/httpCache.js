const DOCUMENT_CACHE_CONTROL =
  "no-store, no-cache, must-revalidate";
const VERSIONED_ASSET_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

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

module.exports = {
  cacheVersionedAsset,
  disableDocumentCache
};
