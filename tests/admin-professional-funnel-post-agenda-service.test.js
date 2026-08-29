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
    agendas_configuradas: 8,
    negocios_publicados: 7,
    perfis_divulgados: 6,
    visitas_pos_divulgacao: 4,
    agendamentos_iniciados_pos_divulgacao: 3,
    primeiros_agendamentos_via_divulgacao: 2,
    primeiros_agendamentos: 3,
    checkouts_iniciados: 1,
    assinaturas_ativadas: 0,
    cadastros_maduros_ativacao: 0,
    cadastros_maduros_monetizacao: 0,
    negocios_publicados_maduros_ativacao: 0,
    primeiros_agendamentos_maduros_ativacao: 0,
    assinaturas_ativadas_maduras_monetizacao: 0,
    investimento_centavos: 10000,
    receita_primeiro_pagamento_centavos: 0,
    ...overrides,
  };
}

describe("funil profissional pós-agenda", () => {
  test("mapeia quantidades e conversões entre etapas consecutivas", () => {
    const campanha = service.mapearLinha(
      linha()
    );

    expect(campanha).toMatchObject({
      agendasConfiguradas: 8,
      perfisDivulgados: 6,
      visitasPosDivulgacao: 4,
      agendamentosIniciadosPosDivulgacao: 3,
      primeirosAgendamentosViaDivulgacao: 2,
      taxaDivulgacaoPosAgenda: 75,
      taxaVisitaPosDivulgacao: 66.67,
      taxaInicioPosVisita: 75,
      taxaConclusaoPosInicio: 66.67,
    });
  });

  test("consolida e resume os novos marcos sem alterar o primeiro agendamento real", () => {
    const consolidadas =
      service.consolidarLinhasCampanha([
        linha({
          cadastros: 5,
          agendas_configuradas: 4,
          perfis_divulgados: 3,
          visitas_pos_divulgacao: 2,
          agendamentos_iniciados_pos_divulgacao: 1,
          primeiros_agendamentos_via_divulgacao: 1,
          primeiros_agendamentos: 2,
        }),
        linha({
          cadastros: 5,
          agendas_configuradas: 4,
          perfis_divulgados: 3,
          visitas_pos_divulgacao: 2,
          agendamentos_iniciados_pos_divulgacao: 2,
          primeiros_agendamentos_via_divulgacao: 1,
          primeiros_agendamentos: 1,
        }),
      ]);

    expect(consolidadas).toHaveLength(1);
    expect(consolidadas[0]).toMatchObject({
      cadastros: 10,
      agendas_configuradas: 8,
      perfis_divulgados: 6,
      visitas_pos_divulgacao: 4,
      agendamentos_iniciados_pos_divulgacao: 3,
      primeiros_agendamentos_via_divulgacao: 2,
      primeiros_agendamentos: 3,
    });

    const resumo = service.criarResumo(
      consolidadas.map((item) =>
        service.mapearLinha(item)
      )
    );

    expect(resumo).toMatchObject({
      agendasConfiguradas: 8,
      perfisDivulgados: 6,
      visitasPosDivulgacao: 4,
      agendamentosIniciadosPosDivulgacao: 3,
      primeirosAgendamentosViaDivulgacao: 2,
      primeirosAgendamentos: 3,
      taxaDivulgacaoPosAgenda: 75,
      taxaVisitaPosDivulgacao: 66.67,
      taxaInicioPosVisita: 75,
      taxaConclusaoPosInicio: 66.67,
    });
  });
});
