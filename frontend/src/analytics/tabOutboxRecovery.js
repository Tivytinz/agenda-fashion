import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage
} from "../utils/browserStorage";

// Documentos diferentes não devem compartilhar sessionUuid nem a fila de uma
// guia clonada. A fila ativa continua em sessionStorage e possui um diário
// durável particionado por guia, atualizado na inclusão e remoção de lotes.
const TAB_KEY = "af_analytics_tab_v1";
const TAB_OWNER_PREFIX = "af_analytics_tab_owner_v1_";
const PARKED_PREFIX = "af_analytics_parked_v1_";
const SESSION_KEY = "af_analytics_session_v2";
const FLOW_KEYS = [
  "af_analytics_onboarding_flow_v2",
  "af_analytics_booking_flow_v2"
];
const OUTBOX_KEY = "af_analytics_outbox_v2";
const RETENTION_MS = 24 * 60 * 60 * 1000;
const OWNER_IDLE_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 40;

function makeUuid() {
  try {
    const value = globalThis.crypto?.randomUUID?.();
    if (value) return value.toLowerCase();
  } catch { /* Browser sem randomUUID. */ }
  const bytes = new Uint8Array(16);
  try {
    globalThis.crypto?.getRandomValues?.(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function parseRecord(raw) {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

let documentId = makeUuid();
let checked = false;
let tabId = null;

function dropInheritedData() {
  for (const key of [SESSION_KEY, ...FLOW_KEYS, OUTBOX_KEY]) {
    removeBrowserStorage("session", key);
  }
}

export function ensureAnalyticsTabIsolation() {
  if (checked) return tabId;
  checked = true;

  const storedId = readBrowserStorage("session", TAB_KEY);
  const hasTabId = validUuid(storedId);
  const owner = hasTabId
    ? parseRecord(readBrowserStorage("local", TAB_OWNER_PREFIX + storedId))
    : null;

  let openedFromOtherTab = false;
  try {
    openedFromOtherTab = typeof window !== "undefined" && Boolean(window.opener);
  } catch { /* Proteção conservadora abaixo. */ }

  // Sessões anteriores à implantação do identificador de guia são legítimas:
  // não apagar aquisição ou tentativa de cadastro só por falta dessa chave.
  // Para guias com posse registrada, a clonagem é detectada sem opener.
  const copied = openedFromOtherTab ||
    (hasTabId && Boolean(owner?.documentId) && owner.documentId !== documentId);

  if (copied) dropInheritedData();
  tabId = copied || !hasTabId ? makeUuid() : storedId;
  writeBrowserStorage("session", TAB_KEY, tabId);

  // Sem localStorage compartilhado não há como comprovar posse. Nesse modo,
  // não reutilizar IDs possivelmente copiados, sem bloquear a navegação.
  if (!writeBrowserStorage("local", TAB_OWNER_PREFIX + tabId,
    JSON.stringify({ documentId, lastSeenAt: Date.now() }))) {
    dropInheritedData();
  }
  return tabId;
}

// Apenas documentos que provaram posse da guia podem usar rascunhos
// pessoais. O armazenamento compartilhado guarda somente IDs opacos.
export function verifiedAnalyticsTabId() {
  const id = ensureAnalyticsTabIsolation();
  const owner = parseRecord(readBrowserStorage("local", TAB_OWNER_PREFIX + id));
  return owner?.documentId === documentId ? id : "";
}

export function releaseAnalyticsTab() {
  if (!tabId) return;
  const key = TAB_OWNER_PREFIX + tabId;
  const owner = parseRecord(readBrowserStorage("local", key));
  if (owner?.documentId === documentId) removeBrowserStorage("local", key);
}

function parkedKeys() {
  try {
    const storage = globalThis.localStorage;
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(PARKED_PREFIX)) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

function validEntry(entry, cutoff) {
  return entry && typeof entry === "object" && validUuid(entry.id) &&
    Number(entry.createdAt) >= cutoff &&
    entry.payload && typeof entry.payload === "object";
}

export function parkAnalyticsOutbox({ entries, revision, visitorId }) {
  const id = ensureAnalyticsTabIsolation();
  if (!validUuid(id) || !validUuid(visitorId)) return;
  const cutoff = Date.now() - RETENTION_MS;
  const pending = (Array.isArray(entries) ? entries : [])
    .filter(entry => validEntry(entry, cutoff)).slice(-MAX_ENTRIES);
  if (!pending.length) {
    removeBrowserStorage("local", PARKED_PREFIX + id);
    return;
  }
  // Atualizar a atividade da guia impede que lotes vivos sejam recuperados
  // por outra guia quando o navegador ainda está processando eventos.
  const ownerKey = TAB_OWNER_PREFIX + id;
  const owner = parseRecord(readBrowserStorage("local", ownerKey));
  if (owner?.documentId === documentId) {
    writeBrowserStorage("local", ownerKey,
      JSON.stringify({ documentId, lastSeenAt: Date.now() }));
  }
  writeBrowserStorage("local", PARKED_PREFIX + id, JSON.stringify({
    revision: String(revision || ""),
    visitorId,
    savedAt: Date.now(),
    entries: pending
  }));
}

// Recuperação somente após identidade compatível. A remoção do snapshot
// ocorre depois que a fila da guia atual foi gravada, para não perder dados
// se a gravação no navegador falhar.
export function pruneExpiredParkedOutboxes() {
  const cutoff = Date.now() - RETENTION_MS;
  for (const key of parkedKeys()) {
    const record = parseRecord(readBrowserStorage("local", key));
    if (!record || !Number.isFinite(Number(record.savedAt)) ||
      Number(record.savedAt) < cutoff) {
      removeBrowserStorage("local", key);
    }
  }
}

export function recoverParkedOutbox({ revision, visitorId, entries, persist }) {
  const cutoff = Date.now() - RETENTION_MS;
  const current = Array.isArray(entries) ? entries : [];
  let added = 0;
  const restored = [...current];
  for (const key of parkedKeys()) {
    const record = parseRecord(readBrowserStorage("local", key));
    if (!record || Number(record.savedAt) < cutoff ||
      record.revision !== String(revision || "") || record.visitorId !== visitorId) {
      removeBrowserStorage("local", key);
      continue;
    }
    const storedTabId = key.slice(PARKED_PREFIX.length);
    const owner = parseRecord(readBrowserStorage("local", TAB_OWNER_PREFIX + storedTabId));
    if (owner?.documentId && owner.documentId !== documentId &&
      Date.now() - Number(owner.lastSeenAt) < OWNER_IDLE_MS) {
      // Não roubar o outbox de outra guia que permanece ativa.
      continue;
    }
    const items = Array.isArray(record.entries)
      ? record.entries.filter(entry => validEntry(entry, cutoff))
      : [];
    if (!items.length) {
      removeBrowserStorage("local", key);
      continue;
    }
    // Mesmos IDs podem ter sido reenviados via keepalive; view/event UUID
    // continuam deduplicados no backend.
    const unique = items.filter(entry =>
      !restored.some(existing => existing.id === entry.id)
    );
    if (!unique.length) {
      if (key !== PARKED_PREFIX + tabId) removeBrowserStorage("local", key);
      continue;
    }
    // Não descartar registros antigos quando a guia atual já está cheia.
    // Conservar a ordem de envio e somente reconhecer itens realmente copiados.
    const capacity = Math.max(0, MAX_ENTRIES - restored.length);
    const sameTab = key === PARKED_PREFIX + tabId;
    if (!capacity && !sameTab) continue;
    const accepted = unique.slice(0, capacity);
    const remaining = unique.slice(accepted.length);

    // Se o journal é o da própria guia, uma nova gravação da fila ativa
    // sobrescreveria o excedente. Estacioná-lo ANTES da mutação.
    let overflowKey = "";
    if (sameTab && remaining.length) {
      overflowKey = PARKED_PREFIX + makeUuid();
      if (!writeBrowserStorage("local", overflowKey,
        JSON.stringify({ ...record, entries: remaining }))) break;
    }
    if (!capacity) {
      if (overflowKey) removeBrowserStorage("local", key);
      continue;
    }
    const next = [...accepted, ...restored];
    if (persist(next) !== true) {
      if (overflowKey) removeBrowserStorage("local", overflowKey);
      break;
    }
    restored.splice(0, restored.length, ...next);
    added += accepted.length;
    if (sameTab) {
      // Persist() já escreveu a fila ativa no seu próprio journal.
      continue;
    }
    if (remaining.length) {
      // Se não for possível reduzir o journal de origem, mantê-lo inteiro
      // para replay idempotente: nunca eliminar os registros excedentes.
      writeBrowserStorage("local", key, JSON.stringify({ ...record, entries: remaining }));
    } else {
      removeBrowserStorage("local", key);
    }
  }
  return added;
}

export function scrubParkedAttribution(stripAcquisition) {
  for (const key of parkedKeys()) {
    const record = parseRecord(readBrowserStorage("local", key));
    if (!record || !Array.isArray(record.entries)) {
      removeBrowserStorage("local", key);
      continue;
    }
    record.entries = record.entries.map(entry => ({
      ...entry,
      payload: {
        ...entry.payload,
        acquisition: stripAcquisition(entry.payload?.acquisition || {})
      }
    }));
    writeBrowserStorage("local", key, JSON.stringify(record));
  }
}

// Utilitários limitados aos testes de clonagem entre documentos. Não alteram
// identidade do usuário, cookie ou autorização.
export const tabOutboxRecoveryInternals = {
  simulateNewDocument() {
    checked = false;
    tabId = null;
    documentId = makeUuid();
  },
  parkedKeys,
  tabKey: TAB_KEY,
  parkedPrefix: PARKED_PREFIX
};
