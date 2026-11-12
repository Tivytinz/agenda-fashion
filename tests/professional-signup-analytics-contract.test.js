const { randomUUID } = require("crypto");
const { normalizarItem } = require("../src/services/analyticsV2Service");
const cases = require("./fixtures/professional-signup-analytics.json");

describe("Contrato de eventos do cadastro profissional", () => {
  test.each(cases)("coletor aceita $name com propriedades estritas: %#", ({ name, properties }) => {
    const result = normalizarItem({
      type: "event", eventUuid: randomUUID(), viewUuid: randomUUID(),
      schemaVersion: 1, occurredAt: new Date().toISOString(), name, properties
    });
    expect(result.name).toBe(name);
    expect(result.properties).toEqual(properties);
  });

  test("remove dados extras e rejeita gatilhos, campos e métodos arbitrários", () => {
    const event = (name, properties) => normalizarItem({
      type: "event", eventUuid: randomUUID(), viewUuid: randomUUID(),
      schemaVersion: 1, occurredAt: new Date().toISOString(), name, properties
    });
    expect(event("professional_signup_validation_error", {
      field: "email", reason: "invalid_format", email: "pessoa@teste.local"
    }).properties).toEqual({ field: "email", reason: "invalid_format" });
    expect(() => event("professional_signup_started", {
      method: "email", trigger: "email@pessoa.local"
    })).toThrow("Gatilho de início de cadastro inválido.");
    expect(() => event("professional_signup_validation_error", {
      field: "telefone@teste.local", reason: "invalid_format"
    })).toThrow("Propriedades do erro de cadastro inválidas.");
    expect(() => event("professional_signup_submitted", {
      method: "outra-credencial"
    })).toThrow("Método de cadastro inválido.");
  });
});
