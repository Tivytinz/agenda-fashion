const PARAMETER = "cadastro-negocio";
const VALID_KEY = /^[A-Za-z0-9._:-]{16,120}$/;

// Referência técnica por conta; nunca contém formulário nem autoriza acesso.
export function readBusinessCreationReference(hash, usuarioId) {
  const value = new URLSearchParams(String(hash || "").replace(/^#/, "")).get(PARAMETER);
  const [account, key, extra] = String(value || "").split("/");
  if (!usuarioId || account !== String(usuarioId) || extra !== undefined || !VALID_KEY.test(key || "")) return null;
  return { key };
}

export function businessCreationReferenceHash(hash, reference) {
  const params = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  if (reference) params.set(PARAMETER, `${reference.usuarioId}/${reference.key}`);
  else params.delete(PARAMETER);
  const value = params.toString();
  return value ? `#${value}` : "";
}
