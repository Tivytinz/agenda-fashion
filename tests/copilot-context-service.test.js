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
