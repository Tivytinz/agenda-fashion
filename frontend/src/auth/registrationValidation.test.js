import { describe, expect, it } from "vitest";
import { isRegistrationComplete, passwordByteLength } from "./registrationValidation";

const complete = {
  nome: "Ana Profissional",
  email: "ana@example.com",
  whatsapp: "(62) 99999-8888",
  senha: "senha1234",
  confirmarSenha: "senha1234"
};

describe("elegibilidade do cadastro na interface", () => {
  it("aceita os dados válidos sem permitir divergência na confirmação", () => {
    expect(isRegistrationComplete(complete)).toBe(true);
    expect(isRegistrationComplete({ ...complete, confirmarSenha: "outra1234" })).toBe(false);
    expect(isRegistrationComplete({ ...complete, whatsapp: "629999888" })).toBe(false);
  });

  it("respeita os limites que o backend valida para nome e e-mail", () => {
    expect(isRegistrationComplete({ ...complete, nome: "A" })).toBe(false);
    expect(isRegistrationComplete({ ...complete, nome: "A".repeat(121) })).toBe(false);
    expect(isRegistrationComplete({ ...complete, email: "a".repeat(150) + "@example.com" })).toBe(false);
    expect(isRegistrationComplete({ ...complete, email: "ana@" })).toBe(false);
  });

  it("bloqueia mais de 72 bytes UTF-8 mesmo com poucos caracteres", () => {
    expect(passwordByteLength("á".repeat(40))).toBe(80);
    expect(isRegistrationComplete({
      ...complete, senha: "á".repeat(40), confirmarSenha: "á".repeat(40)
    })).toBe(false);
    expect(isRegistrationComplete({
      ...complete, senha: "1234567", confirmarSenha: "1234567"
    })).toBe(false);
    expect(isRegistrationComplete({
      ...complete, senha: "a".repeat(72), confirmarSenha: "a".repeat(72)
    })).toBe(true);
  });

  it("preserva a exigência atual de DDD e 10 ou 11 dígitos", () => {
    expect(isRegistrationComplete({ ...complete, whatsapp: "62 3333-2222" })).toBe(true);
    expect(isRegistrationComplete({ ...complete, whatsapp: "62999" })).toBe(false);
    expect(isRegistrationComplete({ ...complete, whatsapp: "+55 62 99999-8888" })).toBe(false);
  });
});
