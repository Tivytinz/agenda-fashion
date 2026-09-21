const {
  flagAtiva,
  valorFlagValido,
} = require("../src/utils/featureFlags");

describe("featureFlags", () => {
  test.each(["1", "true", "TRUE", " yes ", "sim", "ON"])(
    "ativa aliases afirmativos: %s",
    (valor) => {
      expect(flagAtiva(valor)).toBe(true);
      expect(valorFlagValido(valor)).toBe(true);
    }
  );

  test.each(["0", "false", "FALSE", " no ", "nao", "não", "OFF"])(
    "mantém aliases negativos desligados: %s",
    (valor) => {
      expect(flagAtiva(valor)).toBe(false);
      expect(valorFlagValido(valor)).toBe(true);
    }
  );

  test("aceita vazio como configuração opcional e rejeita valor ambíguo", () => {
    expect(valorFlagValido(undefined)).toBe(true);
    expect(valorFlagValido("")).toBe(true);
    expect(valorFlagValido("talvez")).toBe(false);
    expect(flagAtiva("talvez")).toBe(false);
  });
});
