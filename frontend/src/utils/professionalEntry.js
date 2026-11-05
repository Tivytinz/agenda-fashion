import { getBusinessContext, getBusinessWorkspacePath } from "../auth/session";

export const PROFESSIONAL_TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "ttclid",
  "epik",
  "af_source",
  "af_medium",
  "af_content"
];

export function buildProfessionalSignupPath(search = "") {
  const incoming = new URLSearchParams(
    String(search || "").replace(/^\?/, "")
  );
  const outgoing = new URLSearchParams({
    tipo: "profissional"
  });

  for (const key of PROFESSIONAL_TRACKING_PARAMS) {
    const value = incoming.get(key)?.trim();

    if (value) {
      outgoing.set(key, value);
    }
  }

  return `/cadastro?${outgoing.toString()}`;
}


export function buildProfessionalLoginPath(search = "") {
  return buildProfessionalSignupPath(search).replace("/cadastro?", "/entrar?");
}

export function getProfessionalEntry(session, search = "") {
  if (!session?.authenticated) {
    return { label: "Cadastrar meu negócio", path: buildProfessionalSignupPath(search) };
  }
  const owner = getBusinessContext(session, "dono");
  if (owner) return { label: "Meu negócio", path: "/painel" };
  const professional = getBusinessContext(session, "profissional");
  if (professional) return { label: "Minha agenda", path: getBusinessWorkspacePath(session, "profissional") };
  return { label: "Cadastrar meu negócio", path: "/criar-negocio" };
}
