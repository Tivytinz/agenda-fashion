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


// Apenas códigos estáticos saem do navegador; nunca envie valores digitados.
export function registrationFieldError(form, field) {
  const name = String(form?.nome ?? "").trim();
  const email = String(form?.email ?? "").trim().toLowerCase();
  const whatsapp = String(form?.whatsapp ?? "").replace(/\D/g, "");
  const password = String(form?.senha ?? "");
  const confirmation = String(form?.confirmarSenha ?? "");

  switch (field) {
    case "nome":
      return !name ? "required" : name.length < 2 ? "too_short" : name.length > 120 ? "too_long" : null;
    case "email":
      return !email ? "required" : email.length > 160 ? "too_long" : !EMAIL_PATTERN.test(email) ? "invalid_format" : null;
    case "whatsapp":
      return !whatsapp ? "required" : ![10, 11].includes(whatsapp.length) ? "invalid_length" : null;
    case "senha":
      return !password ? "required" : password.length < 8 ? "too_short" : passwordByteLength(password) > 72 ? "too_long" : null;
    case "confirmarSenha":
      return !confirmation ? "required" : confirmation !== password ? "mismatch" : null;
    default:
      return null;
  }
}
