const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { normalizarItem } = require("../src/services/analyticsV2Service");

const browserSource = fs.readFileSync(
  path.resolve(__dirname, "../frontend/src/analytics/firstPartyAnalytics.js"), "utf8"
);
const contract = [
  ["professional_signup_started", [
    { method: "email", trigger: "form_input" },
    { method: "google", trigger: "google_credential" }
  ]],
  ["professional_signup_submitted", [{ method: "email" }, { method: "google" }]],
  ["professional_signup_validation_error", [
    { field: "email", reason: "invalid_format" },
    { field: "password_confirmation", reason: "mismatch" }
  ]],
  ["professional_signup_request_error", [
    { method: "email", reason: "timeout" },
    { method: "google", reason: "network_error" }
  ]]
];

describe("Contrato dos eventos de cadastro entre browser e coletor", () => {
  test.each(contract)("%s tem valores aceitos pelo backend e nome utilizado no frontend", (name, properties) => {
    expect(browserSource).toContain('"' + name + '"');
    for (const value of properties) {
      const actual = normalizarItem({
        type: "event", eventUuid: randomUUID(), viewUuid: randomUUID(), schemaVersion: 1,
        occurredAt: new Date().toISOString(), name, properties: value
      });
      expect(actual.properties).toEqual(value);
      for (const val of Object.values(value)) expect(browserSource).toContain('"' + val + '"');
    }
  });

  test("rejeita valores livres usados como gatilho", () => {
    expect(() => normalizarItem({
      type: "event", eventUuid: randomUUID(), viewUuid: randomUUID(), schemaVersion: 1,
      occurredAt: new Date().toISOString(), name: "professional_signup_started",
      properties: { method: "email", trigger: "usuario@dominio.test" }
    })).toThrow("Gatilho de início de cadastro inválido.");
  });
});
