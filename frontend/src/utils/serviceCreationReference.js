// Referência técnica, sem dados do formulário e sem poder de autorização.
// O fragmento sobrevive a reloads, inclusive com storage indisponível, e não
// acompanha a requisição HTTP do documento nem o Referer.
const PARAMETER = "cadastro-servico";
const VALID_KEY = /^[A-Za-z0-9._:-]{16,120}$/;

export function readServiceCreationReference(hash, usuarioId, negocioId) {
  const value = new URLSearchParams(String(hash || "").replace(/^#/, "")).get(PARAMETER);
  const [account, business, key, extra] = String(value || "").split("/");
  if (!usuarioId || !negocioId || extra !== undefined
    || account !== String(usuarioId) || business !== String(negocioId)
    || !VALID_KEY.test(key || "")) return null;
  return { key };
}

export function serviceCreationReferenceHash(hash, reference) {
  const params = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  if (reference) {
    params.set(PARAMETER, `${reference.usuarioId}/${reference.negocioId}/${reference.key}`);
  } else {
    params.delete(PARAMETER);
  }
  const value = params.toString();
  return value ? `#${value}` : "";
}
