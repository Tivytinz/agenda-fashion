const MEMORY_STORAGE = {
  local: new Map(),
  session: new Map()
};

function memoryFor(kind) {
  return kind === "session"
    ? MEMORY_STORAGE.session
    : MEMORY_STORAGE.local;
}

function nativeStorage(kind) {
  return kind === "session"
    ? globalThis.sessionStorage
    : globalThis.localStorage;
}

export function readBrowserStorage(kind, key) {
  try {
    const storage = nativeStorage(kind);

    if (storage) {
      const value = storage.getItem(key);

      if (value !== null) {
        return value;
      }
    }
  } catch {
    // Alguns modos de privacidade expõem a API, mas bloqueiam o acesso.
  }

  const memory = memoryFor(kind);
  return memory.has(key) ? memory.get(key) : null;
}

export function writeBrowserStorage(kind, key, value) {
  const normalizedValue = String(value);

  try {
    const storage = nativeStorage(kind);

    if (storage) {
      storage.setItem(key, normalizedValue);
      memoryFor(kind).delete(key);
      return true;
    }
  } catch {
    // Mantém a navegação funcional durante esta aba quando o storage é bloqueado.
  }

  memoryFor(kind).set(key, normalizedValue);
  return false;
}

export function removeBrowserStorage(kind, key) {
  try {
    nativeStorage(kind)?.removeItem(key);
  } catch {
    // A remoção em memória ainda evita reutilizar dados dentro desta aba.
  }

  memoryFor(kind).delete(key);
}
