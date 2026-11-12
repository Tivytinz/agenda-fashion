// Apenas rascunho temporário desta guia: nunca localStorage nem dados de login.
const KEY = "af_business_creation_draft_v1";
const MAX_AGE_MS = 30 * 60 * 1000;
const FIELDS = [
  "nome", "descricao", "whatsapp", "cidade", "estado", "bairro",
  "endereco", "numero", "complemento", "cep", "localizacao_url",
  "fuso_horario", "areas"
];

function storage() {
  try { return typeof window === "undefined" ? null : window.sessionStorage; }
  catch { return null; }
}

export function clearBusinessCreationDraft() {
  try { storage()?.removeItem(KEY); } catch { /* Armazenamento indisponível. */ }
}

export function readBusinessCreationDraft(accountId) {
  const id = Number(accountId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (record?.v !== 1 || record?.account !== id ||
        !Number.isFinite(record.savedAt) ||
        Date.now() - record.savedAt > MAX_AGE_MS || record.savedAt > Date.now() ||
        !record.form || typeof record.form !== "object") {
      clearBusinessCreationDraft();
      return null;
    }
    return Object.fromEntries(FIELDS
      .filter(field => Object.prototype.hasOwnProperty.call(record.form, field))
      .map(field => [field, record.form[field]]));
  } catch {
    clearBusinessCreationDraft();
    return null;
  }
}

export function saveBusinessCreationDraft(accountId, form) {
  const id = Number(accountId);
  if (!Number.isSafeInteger(id) || id <= 0 || !form) return;
  const fields = Object.fromEntries(FIELDS.map(field => [
    field, field === "areas" ? [...(Array.isArray(form.areas) ? form.areas : [])].slice(0, 30)
      : String(form[field] ?? "").slice(0, 1200)
  ]));
  try {
    storage()?.setItem(KEY, JSON.stringify({
      v: 1, account: id, savedAt: Date.now(), form: fields
    }));
  } catch { /* Continuar cadastro sem persistência local. */ }
}
