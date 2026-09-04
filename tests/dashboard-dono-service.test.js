jest.mock(
  "../src/services/dashboardService",
  () => ({
    buscarDashboardDono:
      jest.fn(),
  })
);

jest.mock(
  "../src/services/dashboardActivationService",
  () => ({
    buscarAtivacaoNegocio:
      jest.fn(),
  })
);

jest.mock(
  "../src/services/activationNextActionService",
  () => ({
    resolverProximaAcaoAtivacao:
      jest.fn(),
  })
);

jest.mock(
  "../src/services/growthIntelligenceService",
  () => ({
    analyzeGrowthIntelligence:
      jest.fn(),
    unavailableGrowthIntelligence:
      jest.fn(() => ({
        status: "INDISPONIVEL",
        oportunidade_principal: null,
        oportunidades: [],
      })),
  })
);

const dashboardService = require(
  "../src/services/dashboardService"
);
const dashboardActivationService = require(
  "../src/services/dashboardActivationService"
);
const activationNextActionService = require(
  "../src/services/activationNextActionService"
);
const growthIntelligenceService = require(
  "../src/services/growthIntelligenceService"
);
const dashboardDonoService = require(
  "../src/services/dashboardDonoService"
);

describe(
  "dashboardDonoService",
  () => {
    beforeEach(() => {
      jest.resetAllMocks();
      growthIntelligenceService
        .unavailableGrowthIntelligence
        .mockReturnValue({
          status: "INDISPONIVEL",
          oportunidade_principal: null,
          oportunidades: [],
        });
    });

    test(
      "combina dashboard autorizado com ativação, próxima ação e inteligência de crescimento",
      async () => {
        const dashboard = {
          periodo: "7dias",
          negocio: {
            negocio_id: 18,
            papel: "dono",
            nome: "Studio Aurora",
            slug: "studio-aurora",
          },
          resumo: {},
          performance: {},
        };

        dashboardService
          .buscarDashboardDono
          .mockResolvedValue(dashboard);

        const ativacao = {
          possui_servico_ativo: true,
          negocio_publicado: true,
          agenda_configurada: true,
          primeiro_agendamento_recebido: false,
        };
        const proximaAcaoAtivacao = {
          estado:
            "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
          concluido: false,
          titulo: "Divulgue seu perfil",
          mensagem:
            "Compartilhe seu perfil.",
          acao: {
            tipo: "COMPARTILHAR_PERFIL",
            rotulo: "Compartilhar perfil",
          },
        };
        const inteligenciaCrescimento = {
          status: "AGUARDANDO_ATIVACAO",
          oportunidade_principal: null,
          oportunidades: [],
        };

        dashboardActivationService
          .buscarAtivacaoNegocio
          .mockResolvedValue(
            ativacao
          );
        activationNextActionService
          .resolverProximaAcaoAtivacao
          .mockReturnValue(
            proximaAcaoAtivacao
          );
        growthIntelligenceService
          .analyzeGrowthIntelligence
          .mockReturnValue(
            inteligenciaCrescimento
          );

        await expect(
          dashboardDonoService
            .buscarDashboardDono({
              usuarioId: 7,
              periodo: "7dias",
            })
        ).resolves.toEqual({
          ...dashboard,
          ativacao,
          proxima_acao_ativacao:
            proximaAcaoAtivacao,
          inteligencia_crescimento:
            inteligenciaCrescimento,
        });

        expect(
          dashboardService
            .buscarDashboardDono
        ).toHaveBeenCalledWith({
          usuarioId: 7,
          periodo: "7dias",
        });
        expect(
          dashboardActivationService
            .buscarAtivacaoNegocio
        ).toHaveBeenCalledWith({
          negocioId: 18,
        });
        expect(
          activationNextActionService
            .resolverProximaAcaoAtivacao
        ).toHaveBeenCalledWith(
          ativacao
        );
        expect(
          growthIntelligenceService
            .analyzeGrowthIntelligence
        ).toHaveBeenCalledWith({
          dashboard,
          ativacao,
          proximaAcaoAtivacao,
        });
      }
    );

    test(
      "mantém o dashboard disponível quando a inteligência falha",
      async () => {
        const dashboard = {
          periodo: "7dias",
          negocio: {
            negocio_id: 18,
            papel: "dono",
            nome: "Studio Aurora",
            slug: "studio-aurora",
          },
          resumo: {},
          performance: {},
        };
        const ativacao = {
          possui_servico_ativo: true,
          negocio_publicado: true,
          agenda_configurada: true,
          primeiro_agendamento_recebido: true,
        };
        const proximaAcaoAtivacao = {
          estado: "ATIVADO",
          concluido: true,
        };

        dashboardService
          .buscarDashboardDono
          .mockResolvedValue(dashboard);
        dashboardActivationService
          .buscarAtivacaoNegocio
          .mockResolvedValue(ativacao);
        activationNextActionService
          .resolverProximaAcaoAtivacao
          .mockReturnValue(proximaAcaoAtivacao);
        growthIntelligenceService
          .analyzeGrowthIntelligence
          .mockImplementation(() => {
            throw new Error("falha interna");
          });

        await expect(
          dashboardDonoService.buscarDashboardDono({
            usuarioId: 7,
            periodo: "7dias",
          })
        ).resolves.toEqual({
          ...dashboard,
          ativacao,
          proxima_acao_ativacao: proximaAcaoAtivacao,
          inteligencia_crescimento: {
            status: "INDISPONIVEL",
            oportunidade_principal: null,
            oportunidades: [],
          },
        });

        expect(
          growthIntelligenceService.unavailableGrowthIntelligence
        ).toHaveBeenCalledTimes(1);
      }
    );

    test(
      "não consulta ativação nem inteligência quando o dashboard principal falha",
      async () => {
        dashboardService
          .buscarDashboardDono
          .mockRejectedValue(
            new Error("dashboard indisponível")
          );

        await expect(
          dashboardDonoService
            .buscarDashboardDono({
              usuarioId: 7,
              periodo: "7dias",
            })
        ).rejects.toThrow(
          "dashboard indisponível"
        );

        expect(
          dashboardActivationService
            .buscarAtivacaoNegocio
        ).not.toHaveBeenCalled();
        expect(
          activationNextActionService
            .resolverProximaAcaoAtivacao
        ).not.toHaveBeenCalled();
        expect(
          growthIntelligenceService
            .analyzeGrowthIntelligence
        ).not.toHaveBeenCalled();
      }
    );
  }
);
