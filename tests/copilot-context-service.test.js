const {
  buildCopilotShareContext,
} = require("../src/services/copilot/copilotContextService");

describe("copilotContextService", () => {
  it("envia somente contexto agregado e não carrega dados de clientes", () => {
    const contexto = buildCopilotShareContext({
      dashboard: {
        periodo: "30dias",
        negocio: {
          nome: "Studio Rosa",
          slug: "studio-rosa",
        },
        ranking_servicos: [
          {
            id: 2,
            nome: "Alongamento em gel",
            total: 12,
        ativo: true, agendavel: true,
            faturamento: 900,
          },
        ],
        ranking_clientes: [
          {
            nome: "Cliente Sensível",
            whatsapp: "62999999999",
            email: "cliente@example.com",
          },
        ],
      },
      oportunidade: {
        codigo: "SERVICO_COM_TRACAO_CONCENTRADA",
        categoria: "demanda",
        titulo: "Aproveite seu serviço de maior tração",
        evidencias: [
          {
            chave: "participacao_servico_destaque",
            rotulo: "Participação nos agendamentos",
            valor: 60,
            unidade: "%",
          },
          {
            chave: "cliente_nome",
            rotulo: "Cliente",
            valor: 1,
          },
        ],
      },
    });

    expect(contexto).toEqual({
      finalidade: "divulgacao_perfil",
      canal: "whatsapp",
      periodo: "30dias",
      negocio: {
        nome: "Studio Rosa",
      },
      oportunidade: {
        codigo: "SERVICO_COM_TRACAO_CONCENTRADA",
        categoria: "demanda",
        titulo: "Aproveite seu serviço de maior tração",
        evidencias: [
          {
            chave: "participacao_servico_destaque",
            rotulo: "Participação nos agendamentos",
            valor: 60,
            unidade: "%",
          },
        ],
      },
      servico_destaque: {
        nome: "Alongamento em gel",
        agendamentos: 12,
      },
    });

    expect(JSON.stringify(contexto)).not.toContain("Cliente Sensível");
    expect(JSON.stringify(contexto)).not.toContain("62999999999");
    expect(JSON.stringify(contexto)).not.toContain("cliente@example.com");
    expect(JSON.stringify(contexto)).not.toContain("studio-rosa");
  });
});

it("não inclui serviço desativado no contexto do gerador", () => {
  const context = buildCopilotShareContext({ dashboard: {
    ranking_servicos: [
      { nome: "Antigo", total: 8, ativo: false },
      { nome: "Atual", total: 2, ativo: true, agendavel: true },
    ],
  } });
  expect(context.servico_destaque).toEqual({ nome: "Atual", agendamentos: 2 });
});

it("exclui serviço ativo sem disponibilidade do contexto de divulgação", () => {
  const context = buildCopilotShareContext({ dashboard: { ranking_servicos: [
    { nome: "Sem habilitação", total: 8, ativo: true, agendavel: false },
    { nome: "Agendável", total: 2, ativo: true, agendavel: true },
  ] } });
  expect(context.servico_destaque.nome).toBe("Agendável");
});
