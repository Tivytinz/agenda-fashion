jest.mock("../src/services/dashboardDonoService", () => ({
  buscarDashboardDono: jest.fn(),
}));

jest.mock("../src/services/copilot/openaiProvider", () => ({
  isEnabled: jest.fn(),
  generateShareCopy: jest.fn(),
}));

const dashboardDonoService = require("../src/services/dashboardDonoService");
const openaiProvider = require("../src/services/copilot/openaiProvider");
const copilotShareService = require("../src/services/copilotShareService");

function dashboardComOportunidade() {
  return {
    periodo: "30dias",
    negocio: {
      negocio_id: 11,
      nome: "Studio Rosa",
      slug: "studio-rosa",
    },
    ranking_servicos: [
      {
        id: 8,
        nome: "Alongamento em gel",
        total: 12,
      },
    ],
    inteligencia_crescimento: {
      status: "OPORTUNIDADE_PRIORIZADA",
      periodo: "30dias",
      oportunidade_principal: {
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
        acao: {
          tipo: "COMPARTILHAR_PERFIL",
        },
      },
    },
  };
}

describe("copilotShareService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dashboardDonoService.buscarDashboardDono.mockResolvedValue(
      dashboardComOportunidade()
    );
  });

  it("usa fallback quando a IA está desligada", async () => {
    openaiProvider.isEnabled.mockReturnValue(false);

    const resultado = await copilotShareService.gerarDivulgacao({
      usuarioId: 5,
      periodo: "30dias",
      canal: "whatsapp",
    });

    expect(resultado.fonte).toBe("fallback");
    expect(resultado.texto).toContain("Alongamento em gel");
    expect(resultado.texto).not.toMatch(/https?:\/\//i);
    expect(openaiProvider.generateShareCopy).not.toHaveBeenCalled();
    expect(dashboardDonoService.buscarDashboardDono).toHaveBeenCalledWith({
      usuarioId: 5,
      periodo: "30dias",
    });
  });

  it("usa a saída estruturada da IA quando ela é válida", async () => {
    openaiProvider.isEnabled.mockReturnValue(true);
    openaiProvider.generateShareCopy.mockResolvedValue({
      titulo: "Alongamento em destaque",
      texto: "Seu alongamento está em destaque. Veja os serviços e escolha seu horário.",
    });

    const resultado = await copilotShareService.gerarDivulgacao({
      usuarioId: 5,
      periodo: "30dias",
      canal: "whatsapp",
    });

    expect(resultado).toEqual(expect.objectContaining({
      fonte: "openai",
      canal: "whatsapp",
      oportunidade: "SERVICO_COM_TRACAO_CONCENTRADA",
      titulo: "Alongamento em destaque",
    }));
  });

  it("volta ao fallback quando o provedor falha ou inclui URL", async () => {
    openaiProvider.isEnabled.mockReturnValue(true);
    openaiProvider.generateShareCopy.mockResolvedValue({
      titulo: "Veja agora",
      texto: "Conheça o perfil em https://example.com e agende.",
    });

    const resultado = await copilotShareService.gerarDivulgacao({
      usuarioId: 5,
      periodo: "30dias",
    });

    expect(resultado.fonte).toBe("fallback");
    expect(resultado.texto).not.toContain("example.com");
  });

  it("não gera divulgação quando a oportunidade atual não recomenda compartilhar", async () => {
    dashboardDonoService.buscarDashboardDono.mockResolvedValue({
      ...dashboardComOportunidade(),
      inteligencia_crescimento: {
        status: "OPORTUNIDADE_PRIORIZADA",
        oportunidade_principal: {
          codigo: "CONVERSAO_BAIXA_COM_AMOSTRA",
          acao: {
            tipo: "NAVEGAR",
            destino: "/painel/negocio",
          },
        },
      },
    });

    await expect(
      copilotShareService.gerarDivulgacao({
        usuarioId: 5,
        periodo: "30dias",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("não aceita canal arbitrário", async () => {
    await expect(
      copilotShareService.gerarDivulgacao({
        usuarioId: 5,
        canal: "prompt_livre",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
