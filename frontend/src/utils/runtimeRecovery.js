const RECOVERY_KEY = "af_runtime_asset_recovery";
const RECOVERY_PARAM = "_af_reload";
const RECOVERY_WINDOW_MS = 60_000;

const STALE_ASSET_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /unable to preload css/i,
  /loading (?:css )?chunk [^ ]+ failed/i,
  /chunkloaderror/i
];

function errorText(error) {
  return [
    error?.name,
    error?.message,
    error?.cause?.name,
    error?.cause?.message
  ].filter(Boolean).join(" ");
}

function safeStorageGet(storage, key) {
  try {
    return storage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function safeStorageSet(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // A URL com cache busting ainda permite recuperar sem sessionStorage.
  }
}

function safeStorageRemove(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // Não é necessário persistir nada para concluir a recuperação.
  }
}

function defaultSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function isStaleAssetError(error) {
  const message = errorText(error);
  return STALE_ASSET_PATTERNS.some((pattern) => pattern.test(message));
}

export function freshAssetUrl(href, token = Date.now()) {
  const url = new URL(href);
  url.searchParams.set(RECOVERY_PARAM, String(token));
  return url.href;
}

export function reloadWithFreshAssets(options = {}) {
  const location = options.location || window.location;
  const now = options.now ?? Date.now();
  location.replace(freshAssetUrl(location.href, now));
}

export function recoverFromStaleAssets(error, options = {}) {
  if (!isStaleAssetError(error)) {
    return false;
  }

  const location = options.location || window.location;
  const storage = Object.prototype.hasOwnProperty.call(options, "storage")
    ? options.storage
    : defaultSessionStorage();
  const now = options.now ?? Date.now();
  let urlAttempt = 0;

  try {
    urlAttempt = Number(
      new URL(location.href).searchParams.get(RECOVERY_PARAM)
    );
  } catch {
    urlAttempt = 0;
  }

  const previousAttempt = Number(
    safeStorageGet(storage, RECOVERY_KEY)
  );

  if (
    (
      Number.isFinite(previousAttempt) &&
      previousAttempt > 0 &&
      now - previousAttempt < RECOVERY_WINDOW_MS
    ) ||
    (
      Number.isFinite(urlAttempt) &&
      urlAttempt > 0 &&
      now - urlAttempt < RECOVERY_WINDOW_MS
    )
  ) {
    return false;
  }

  safeStorageSet(storage, RECOVERY_KEY, String(now));
  reloadWithFreshAssets({ location, now });
  return true;
}

export function markRuntimeReady(options = {}) {
  const history = options.history || window.history;
  const location = options.location || window.location;
  const storage = Object.prototype.hasOwnProperty.call(options, "storage")
    ? options.storage
    : defaultSessionStorage();

  safeStorageRemove(storage, RECOVERY_KEY);

  try {
    const url = new URL(location.href);

    if (!url.searchParams.has(RECOVERY_PARAM)) {
      return;
    }

    url.searchParams.delete(RECOVERY_PARAM);
    history.replaceState(
      history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  } catch {
    // A limpeza do parâmetro não interfere no funcionamento da aplicação.
  }
}

export function installRuntimeRecovery(target = window) {
  function handlePreloadError(event) {
    const recovered = recoverFromStaleAssets(
      event.payload || event.reason || event
    );

    if (recovered) {
      event.preventDefault?.();
    }
  }

  target.addEventListener("vite:preloadError", handlePreloadError);
  return () => target.removeEventListener(
    "vite:preloadError",
    handlePreloadError
  );
}
