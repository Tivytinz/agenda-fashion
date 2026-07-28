const {
  documentoValido,
  normalizarDocumento
} = require("../src/utils/documento");

describe("validação de CPF/CNPJ", () => {
  test.each([
    "111.444.777-35",
    "11.222.333/0001-81"
  ])("aceita documento válido: %s", (documento) => {
    expect(documentoValido(documento)).toBe(true);
  });

  test.each([
    "",
    "111.111.111-11",
    "111.444.777-34",
    "11.222.333/0001-80"
  ])("rejeita documento inválido: %s", (documento) => {
    expect(documentoValido(documento)).toBe(false);
  });

  test("remove a máscara do documento", () => {
    expect(
      normalizarDocumento("11.222.333/0001-81")
    ).toBe("11222333000181");
  });
});
