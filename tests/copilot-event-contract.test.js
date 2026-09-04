const {
  EVENTOS_PERMITIDOS,
  sanitizarPropriedades,
} = require("../src/services/eventoProdutoService");

describe("contrato de eventos do Copilot", () => {
  it("aceita eventos e propriedades previstas sem carregar campos arbitrários", () => {
    expect(EVENTOS_PERMITIDOS.has("copilot_divulgacao_solicitada")).toBe(true);
    expect(EVENTOS_PERMITIDOS.has("copilot_divulgacao_gerada")).toBe(true);

    expect(
      sanitizarPropriedades({
        codigo_oportunidade: "SERVICO_COM_TRACAO_CONCENTRADA",
        categoria_oportunidade: "demanda",
        canal_copilot: "whatsapp",
        fonte_copilot: "openai",
        prompt: "não deve persistir",
        cliente_whatsapp: "62999999999",
      })
    ).toEqual({
      codigo_oportunidade: "SERVICO_COM_TRACAO_CONCENTRADA",
      categoria_oportunidade: "demanda",
      canal_copilot: "whatsapp",
      fonte_copilot: "openai",
    });
  });
});
