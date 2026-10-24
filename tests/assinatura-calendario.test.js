const { execFileSync } = require("node:child_process");
const { dataValida, acessoPagoAindaValido, calcularProximaCobranca } = require("../src/services/assinaturaCalculos");

test.each([null, "", " "])("não inventa mês a partir de data ausente %p", (value) => {
  expect(() => calcularProximaCobranca(value)).toThrow("Não foi possível calcular");
});

test.each([null, undefined, "", "2026-02-29", "2026-02-31", "2099-13-01", "0000-01-01", new Date(NaN)])(
  "rejeita data de calendário inválida %p", (value) => expect(dataValida(value)).toBeNull()
);

test.each(["2024-02-29", "2099-12-01", "2099-12-01T08:00:00.000Z"])(
  "preserva a data textual válida %s", (value) => expect(dataValida(value)).toBe(value.slice(0, 10))
);

test.each(["UTC", "America/Sao_Paulo", "America/Los_Angeles", "Pacific/Kiritimati"])(
  "DATE do parser pg mantém o dia civil no processo em %s", (timezone) => {
    const code = `
      const { types } = require(${JSON.stringify(require.resolve("pg"))});
      const calc = require(${JSON.stringify(require.resolve("../src/services/assinaturaCalculos"))});
      const date = types.getTypeParser(1082, 'text')('2099-12-01');
      process.stdout.write(JSON.stringify({ date: calc.dataValida(date),
        valid: calc.acessoPagoAindaValido({ ativo: true, data_proxima_cobranca: date }),
        next: calc.calcularProximaCobranca(calc.dataValida(date)) }));
    `;
    const result = JSON.parse(execFileSync(process.execPath, ["-e", code], {
      env: { ...process.env, TZ: timezone }, encoding: "utf8", timeout: 10000,
    }));
    expect(result).toEqual({ date: "2099-12-01", valid: true, next: "2100-01-01" });
  }
);

test("período realmente expirado ou assinatura inativa não conserva acesso pago", () => {
  expect(acessoPagoAindaValido({ ativo: true, data_proxima_cobranca: "2000-01-01" })).toBe(false);
  expect(acessoPagoAindaValido({ ativo: false, data_proxima_cobranca: "2099-12-01" })).toBe(false);
});
