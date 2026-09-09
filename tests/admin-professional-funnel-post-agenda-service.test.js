const service = require(
  "../src/services/adminProfessionalFunnelService"
);

function linha(overrides = {}) {
  return {
    origem: "meta",
    midia: "cpc",
    campanha: "profissionais_teste",
    classificacao_atribuicao: "oficial",
    campanha_oficial_id: 1,
    cadastros: 10,
    negocios_criados: 9,
    servicos_criados: 8,
    negocios_publicados: 7,
    primeiros_agendamentos: 3,
    checkouts_iniciados: 1,
    assinaturas_ativadas: 0,
    cadastros_maduros_ativacao: 10,
    cadastros_maduros_monetizacao: 0,
    negocios_publicados_maduros_ativacao: 7,
    primeiros_agendamentos_maduros_ativacao: 3,
    assinaturas_ativadas_maduras_monetizacao: 0,
    investimento_centavos: 10000,
    receita_primeiro_pagamento_centavos: 0,
    ...overrides,
  };
}

describe("funil profissional canônico", () => {
  test("mapeia os marcos de aquisição sem transformar disponibilidade em etapa", () => {
    const campanha = service.mapearLinha(linha());

    expect(campanha).toMatchObject({
      cadastros: 10,
      negociosCriados: 9,
      servicosCriados: 8,
      negociosPublicados: 7,
      primeirosAgendamentos: 3,
      checkoutsIniciados: 1,
      assinaturasAtivadas: 0,
      taxaPublicacao: 70,
      taxaPrimeiroAgendamento: 30,
      taxaCheckout: 10,
    });
    expect(campanha).not.toHaveProperty("agendasConfiguradas");
    expect(campanha).not.toHaveProperty("taxaAgenda");
    expect(campanha).not.toHaveProperty("perfisDivulgados");
    expect(campanha).not.toHaveProperty("taxaDivulgacaoPosAgenda");
  });

  test("consolida somente os marcos canônicos por identidade e classificação", () => {
    const consolidadas = service.consolidarLinhasCampanha([
      linha({ cadastros: 5, primeiros_agendamentos: 2 }),
      linha({ cadastros: 5, primeiros_agendamentos: 1 }),
    ]);

    expect(consolidadas).toHaveLength(1);
    expect(consolidadas[0]).toMatchObject({
      cadastros: 10,
      negocios_criados: 18,
      servicos_criados: 16,
      negocios_publicados: 14,
      primeiros_agendamentos: 3,
      checkouts_iniciados: 2,
    });
    expect(consolidadas[0]).not.toHaveProperty("agendas_configuradas");
    expect(consolidadas[0]).not.toHaveProperty("perfis_divulgados");
  });
});
