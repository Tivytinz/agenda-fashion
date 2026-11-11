// Regras de elegibilidade da interface. O authService no backend continua
// sendo a autoridade para validar e persistir o cadastro.
export const WHATSAPP_PATTERN = "(?:[^0-9]*[0-9]){10,11}[^0-9]*";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function passwordByteLength(value) {
  return new TextEncoder().encode(String(value ?? "")).length;
}

export function isRegistrationComplete(form) {
  const nome = String(form?.nome ?? "").trim();
  const email = String(form?.email ?? "").trim().toLowerCase();
  const whatsapp = String(form?.whatsapp ?? "");
  const senha = String(form?.senha ?? "");
  const confirmacao = String(form?.confirmarSenha ?? "");
  const digits = whatsapp.replace(/\D/g, "");

  return nome.length >= 2 && nome.length <= 120 &&
    email.length <= 160 && EMAIL_PATTERN.test(email) &&
    (digits.length === 10 || digits.length === 11) &&
    passwordByteLength(senha) >= 8 &&
    passwordByteLength(senha) <= 72 &&
    senha.length >= 8 &&
    senha === confirmacao;
}
