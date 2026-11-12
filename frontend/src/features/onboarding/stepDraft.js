// Rascunho transitório desta aba. Inclui File em memória (nunca no storage).
// O backend permanece autoridade sobre negócios, serviços e horários.
const TIMEOUT_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 8;
const drafts = new Map();

export function saveStepDraft(key, data) {
  if (typeof key !== "string" || !key) return;
  drafts.delete(key);
  drafts.set(key, { savedAt: Date.now(), data });
  while (drafts.size > MAX_ENTRIES) drafts.delete(drafts.keys().next().value);
}

export function readStepDraft(key) {
  const entry = drafts.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > TIMEOUT_MS || entry.savedAt > Date.now()) {
    drafts.delete(key);
    return null;
  }
  return entry.data;
}

export function clearStepDraft(key) {
  drafts.delete(key);
}
