const {
  GROWTH_INTELLIGENCE_STATUS,
  analyzeGrowthIntelligence,
} = require(
  "../src/services/growthIntelligenceService"
);
const {
  MIN_PROFILE_VISITS_FOR_CONVERSION,
  buildGrowthSignals,
} = require(
  "../src/services/growthIntelligence/signalService"
);

const ATIVACAO_CONCLUIDA = Object.freeze({
  possui_servico_ativo: true,
  negocio_publicado: true,
  primeiro_agendamento_recebido: true,
});

const PROXIMA_ACAO_CONCLUIDA = Object.freeze({
  estado: "ATIVADO",
  concluido: true,
});

function analyze(dashboard, overrides = {}) {
  return analyzeGrowthIntelligence({
    dashboard,
    ativacao:
      overrides.ativacao ||
      ATIVACAO_CONCLUIDA,
    proximaAcaoAtivacao:
      overrides.proximaAcaoAtivacao ||
      PROXIMA_ACAO_CONCLUIDA,
  });
}

describe("growthIntelligenceService", () => {
  test.each([false, true])(
    "prioriza horários sem disponibilidade; telemetria indisponível: %s",
    (telemetriaIndisponivel) => {
      const ativacao = {
        ...ATIVACAO_CONCLUIDA,
        possui_disponibilidade_agendavel: false,
      };
      const result = analyze({
        periodo: "7dias",
        qualidade_dados: telemetriaIndisponivel
          ? { desempenho_perfil: "indisponivel", favoritos: "indisponivel" }
          : {},
        resumo: { servicos_vendidos: 8 },
        performance: {
          visitas_perfil: 30,
          agendamentos_concluidos: 8,
          taxa_conversao: 26.7,
        },
        ranking_servicos: [{ id: 1, nome: "Manicure", total: 8, ativo: true }],
      }, { ativacao });

      expect(result.status).toBe(GROWTH_INTELLIGENCE_STATUS.OPORTUNIDADE_PRIORIZADA);
      expect(result.oportunidade_principal.codigo).toBe("REVISAR_DISPONIBILIDADE");
      expect(result.oportunidade_principal.acao).toEqual({
        tipo: "NAVEGAR", rotulo: "Revisar horários", destino: "/painel/horarios",
      });
      expect(result.oportunidades).toHaveLength(1);
      expect(JSON.stringify(result)).not.toContain("COMPARTILHAR_PERFIL");
      expect(ativacao).toEqual({
        ...ATIVACAO_CONCLUIDA,
        possui_disponibilidade_agendavel: false,
      });
    }
  );

  test("preserva a missão inicial quando ainda não há primeiro agendamento", () => {
    const result = analyze({}, {
      ativacao: {
        ...ATIVACAO_CONCLUIDA,
        primeiro_agendamento_recebido: false,
        possui_disponibilidade_agendavel: false,
      },
      proximaAcaoAtivacao: { concluido: false },
    });
    expect(result.status).toBe(GROWTH_INTELLIGENCE_STATUS.AGUARDANDO_ATIVACAO);
    expect(result.oportunidade_principal).toBeNull();
  });

  test.each([true, undefined])("preserva divulgação com disponibilidade %s", (disponibilidade) => {
    const result = analyze({
      resumo: { servicos_vendidos: 8 },
      performance: { visitas_perfil: 30, agendamentos_concluidos: 8, taxa_conversao: 26.7 },
      ranking_servicos: [{ id: 1, nome: "Manicure", total: 8, ativo: true }],
    }, {
      ativacao: {
        ...ATIVACAO_CONCLUIDA,
        possui_disponibilidade_agendavel: disponibilidade,
      },
    });
    expect(result.oportunidade_principal.acao.tipo).toBe("COMPARTILHAR_PERFIL");
  });

  test("distingue reservas não canceladas de atendimentos realizados", () => {
    const result = analyze({
      performance: { visitas_perfil: 50, agendamentos_concluidos: 0 },
    });
    expect(result.oportunidade_principal.evidencias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rotulo: "Agendamentos não cancelados" }),
      ])
    );
    expect(JSON.stringify(result)).not.toContain("concluído");
  });

  test.each(["desempenho_perfil", "favoritos"])("não recomenda ações quando %s está indisponível", (campo) => {
    const result = analyze({
      periodo: "7dias",
      qualidade_dados: { desempenho_perfil: "disponivel", favoritos: "disponivel", [campo]: "indisponivel" },
      performance: { visitas_perfil: null, favoritos_recebidos: 0 },
    });

    expect(result).toEqual({
      status: GROWTH_INTELLIGENCE_STATUS.INDISPONIVEL,
      periodo: "7dias",
      oportunidade_principal: null,
      oportunidades: [],
    });
  });

  test("mantém 20 visitas como limiar canônico para avaliar conversão", () => {
    expect(MIN_PROFILE_VISITS_FOR_CONVERSION).toBe(20);
    expect(buildGrowthSignals({
      performance: { visitas_perfil: 19 },
    }).amostra_conversao_suficiente).toBe(false);
    expect(buildGrowthSignals({
      performance: { visitas_perfil: 20 },
    }).amostra_conversao_suficiente).toBe(true);
  });

  test("não exige agenda configurada depois que a ativação canônica foi concluída", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 20,
      },
      performance: {
        visitas_perfil: 20,
        agendamentos_concluidos: 4,
        taxa_conversao: 20,
      },
    }, {
      ativacao: {
        ...ATIVACAO_CONCLUIDA,
        agenda_configurada: false,
      },
    });

    expect(result.status).not.toBe(
      GROWTH_INTELLIGENCE_STATUS.AGUARDANDO_ATIVACAO
    );
  });

  test("não compete com a máquina de ativação antes do primeiro agendamento", () => {
    const result = analyze(
      {
        resumo: {
          servicos_vendidos: 0,
        },
        performance: {
          visitas_perfil: 100,
          agendamentos_concluidos: 0,
          taxa_conversao: 0,
        },
      },
      {
        ativacao: {
          ...ATIVACAO_CONCLUIDA,
          primeiro_agendamento_recebido: false,
        },
        proximaAcaoAtivacao: {
          estado: "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
          concluido: false,
        },
      }
    );

    expect(result).toEqual({
      status:
        GROWTH_INTELLIGENCE_STATUS.AGUARDANDO_ATIVACAO,
      oportunidade_principal: null,
      oportunidades: [],
    });
  });

  test("não força recomendação com amostra pequena", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 0,
      },
      performance: {
        visitas_perfil: 12,
        agendamentos_concluidos: 0,
        taxa_conversao: 0,
        cliques_whatsapp: 3,
        cliques_maps: 0,
        favoritos_recebidos: 1,
      },
      ranking_servicos: [],
    });

    expect(result.status).toBe(
      GROWTH_INTELLIGENCE_STATUS.DADOS_INSUFICIENTES
    );
    expect(result.oportunidade_principal).toBeNull();
  });

  test("prioriza conversão quando há visitas suficientes e nenhum agendamento concluído", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 0,
      },
      performance: {
        visitas_perfil: 50,
        agendamentos_concluidos: 0,
        taxa_conversao: 0,
        cliques_whatsapp: 8,
        cliques_maps: 2,
        favoritos_recebidos: 3,
      },
      ranking_servicos: [],
    });

    expect(result.status).toBe(
      GROWTH_INTELLIGENCE_STATUS.OPORTUNIDADE_PRIORIZADA
    );
    expect(result.oportunidades.length).toBeGreaterThan(1);
    expect(result.oportunidade_principal.codigo).toBe(
      "CONVERSAO_SEM_AGENDAMENTO"
    );
    expect(result.oportunidade_principal.score).toBeGreaterThan(
      result.oportunidades[1].score
    );
  });

  test("gera hipótese de interesse sem conclusão sem afirmar causalidade", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 8,
      },
      performance: {
        visitas_perfil: 80,
        agendamentos_concluidos: 8,
        taxa_conversao: 10,
        cliques_whatsapp: 15,
        cliques_maps: 5,
        favoritos_recebidos: 3,
      },
      ranking_servicos: [
        { id: 1, nome: "Manicure", total: 4, ativo: true },
        { id: 2, nome: "Pedicure", total: 4, ativo: true },
      ],
    });

    expect(result.oportunidade_principal.codigo).toBe(
      "INTERESSE_SEM_CONCLUSAO_PROPORCIONAL"
    );
    expect(result.oportunidade_principal.mensagem).toMatch(
      /sem assumir uma causa específica/i
    );
  });

  test("reconhece serviço com tração usando todos os agendamentos do período como denominador", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 20,
      },
      performance: {
        visitas_perfil: 100,
        agendamentos_concluidos: 20,
        taxa_conversao: 20,
        cliques_whatsapp: 4,
        cliques_maps: 0,
        favoritos_recebidos: 0,
      },
      ranking_servicos: [
        { id: 1, nome: "Alongamento em gel", total: 12, ativo: true },
        { id: 2, nome: "Manicure", total: 5, ativo: true },
        { id: 3, nome: "Pedicure", total: 3, ativo: true },
      ],
    });

    expect(result.oportunidade_principal.codigo).toBe(
      "SERVICO_COM_TRACAO_CONCENTRADA"
    );
    expect(result.oportunidade_principal.acao.tipo).toBe(
      "COMPARTILHAR_PERFIL"
    );
    expect(result.oportunidade_principal.evidencias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          chave: "participacao_servico_destaque",
          valor: 60,
        }),
      ])
    );
  });

  test("não infla participação do serviço usando apenas o top 5 do ranking", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 20,
      },
      performance: {
        visitas_perfil: 10,
        agendamentos_concluidos: 2,
        taxa_conversao: 20,
        cliques_whatsapp: 0,
        cliques_maps: 0,
        favoritos_recebidos: 0,
      },
      ranking_servicos: [
        { id: 1, nome: "Alongamento", total: 8, ativo: true },
        { id: 2, nome: "Manicure", total: 2, ativo: true },
      ],
    });

    expect(result.status).toBe(
      GROWTH_INTELLIGENCE_STATUS.SEM_OPORTUNIDADE_PRIORITARIA
    );
    expect(result.oportunidade_principal).toBeNull();
  });

  test("diferencia dados suficientes de ausência de oportunidade prioritária", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 20,
      },
      performance: {
        visitas_perfil: 100,
        agendamentos_concluidos: 20,
        taxa_conversao: 20,
        cliques_whatsapp: 1,
        cliques_maps: 0,
        favoritos_recebidos: 1,
      },
      ranking_servicos: [
        { id: 1, nome: "Manicure", total: 6, ativo: true },
        { id: 2, nome: "Pedicure", total: 5, ativo: true },
        { id: 3, nome: "Escova", total: 4, ativo: true },
        { id: 4, nome: "Corte", total: 3, ativo: true },
        { id: 5, nome: "Sobrancelha", total: 2, ativo: true },
      ],
    });

    expect(result.status).toBe(
      GROWTH_INTELLIGENCE_STATUS.SEM_OPORTUNIDADE_PRIORITARIA
    );
    expect(result.oportunidade_principal).toBeNull();
  });

  test("não envia dados de clientes na recomendação estruturada", () => {
    const result = analyze({
      resumo: {
        servicos_vendidos: 0,
      },
      performance: {
        visitas_perfil: 30,
        agendamentos_concluidos: 0,
        taxa_conversao: 0,
      },
      ranking_clientes: [
        {
          id: 99,
          nome: "Cliente Exemplo",
          whatsapp: "62999999999",
        },
      ],
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Cliente Exemplo");
    expect(serialized).not.toContain("62999999999");
    expect(serialized).not.toContain("ranking_clientes");
  });
});

describe("diagnóstico operacional pós-ativação", () => {
  test.each([
    ["SEM_PROFISSIONAL_HABILITADA", "/painel/profissionais", "Habilite uma profissional"],
    ["SEM_HORARIOS", "/painel/horarios", "Revise os horários"],
    ["DURACAO_INCOMPATIVEL", "/painel/horarios", "Ajuste as faixas"],
  ])("direciona a causa %s sem depender de telemetria", (motivo, destino, titulo) => {
    const result = analyze({ qualidade_dados: { desempenho_perfil: "indisponivel" } }, {
      ativacao: { ...ATIVACAO_CONCLUIDA, possui_disponibilidade_agendavel: false, motivo_indisponibilidade: motivo },
    });
    expect(result.oportunidade_principal.acao).toMatchObject({ tipo: "NAVEGAR", destino });
    expect(result.oportunidade_principal.titulo).toContain(titulo);
    expect(result.oportunidade_principal.mensagem).toContain("Se a pausa for intencional");
  });
});

describe("orientação para horários da equipe", () => {
  test.each(["SEM_HORARIOS", "DURACAO_INCOMPATIVEL"])("encaminha à equipe quando a dona não atende o serviço: %s", (motivo) => {
    const ativacao = {
      possui_servico_ativo: true, negocio_publicado: true,
      possui_disponibilidade_agendavel: false, motivo_indisponibilidade: motivo,
      revisar_horarios_na_equipe: true,
      primeiro_agendamento_recebido: true,
    };
    const resultado = analyze({}, { ativacao }).oportunidade_principal;
    expect(resultado.acao).toEqual({ tipo: "NAVEGAR", rotulo: "Revisar horários da equipe", destino: "/painel/profissionais" });
    expect(resultado.mensagem).toContain("configure os horários de uma profissional habilitada");
  });
});

 test.each([false, undefined, null])("não promove serviço sem confirmação de oferta ativa: %s", (ativo) => {
   const signals = buildGrowthSignals({
     resumo: { servicos_vendidos: 10 },
     ranking_servicos: [
       { id: 1, nome: "Serviço antigo", total: 8, ativo },
       { id: 2, nome: "Serviço atual", total: 2, ativo: true },
     ],
   });
   expect(signals.ranking_servicos).toHaveLength(2);
   expect(signals.ranking_servicos[0].total).toBe(8);
   expect(signals.servico_destaque.nome).toBe("Serviço atual");
   expect(signals.participacao_servico_destaque).toBe(20);
   const result = analyze({
     resumo: { servicos_vendidos: 10 },
     ranking_servicos: signals.ranking_servicos,
   });
   expect(JSON.stringify(result.oportunidades)).not.toContain("SERVICO_COM_TRACAO_CONCENTRADA");
 });
