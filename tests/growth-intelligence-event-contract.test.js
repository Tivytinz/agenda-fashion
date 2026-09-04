const eventoProdutoService = require(
  "../src/services/eventoProdutoService"
);

describe("contrato de eventos da inteligência de crescimento", () => {
  test("aceita os nomes de evento usados pelo dashboard", () => {
    expect(
      eventoProdutoService.EVENTOS_PERMITIDOS.has(
        "oportunidade_crescimento_visualizada"
      )
    ).toBe(true);
    expect(
      eventoProdutoService.EVENTOS_PERMITIDOS.has(
        "oportunidade_crescimento_selecionada"
      )
    ).toBe(true);
  });

  test("preserva somente propriedades operacionais permitidas", () => {
    const propriedades =
      eventoProdutoService.sanitizarPropriedades({
        codigo_oportunidade:
          "CONVERSAO_SEM_AGENDAMENTO",
        categoria_oportunidade:
          "conversao",
        tipo_acao:
          "NAVEGAR",
        telefone:
          "62999999999",
        email:
          "cliente@email.com",
      });

    expect(propriedades).toEqual({
      codigo_oportunidade:
        "CONVERSAO_SEM_AGENDAMENTO",
      categoria_oportunidade:
        "conversao",
      tipo_acao:
        "NAVEGAR",
    });
  });
});
