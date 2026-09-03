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

const dashboardService = require(
  "../src/services/dashboardService"
);
const dashboardActivationService = require(
  "../src/services/dashboardActivationService"
);
const activationNextActionService = require(
  "../src/services/activationNextActionService"
);
const dashboardDonoService = require(
  "../src/services/dashboardDonoService"
);

describe(
  "dashboardDonoService",
  () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    test(
      "combina dashboard autorizado com ativação e próxima ação canônicas",
      async () => {
        dashboardService
          .buscarDashboardDono
          .mockResolvedValue({
            periodo: "7dias",
            negocio: {
              negocio_id: 18,
              papel: "dono",
              nome: "Studio Aurora",
              slug: "studio-aurora",
            },
            resumo: {},
            performance: {},
          });

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

        await expect(
          dashboardDonoService
            .buscarDashboardDono({
              usuarioId: 7,
              periodo: "7dias",
            })
        ).resolves.toEqual({
          periodo: "7dias",
          negocio: {
            negocio_id: 18,
            papel: "dono",
            nome: "Studio Aurora",
            slug: "studio-aurora",
          },
          resumo: {},
          performance: {},
          ativacao,
          proxima_acao_ativacao:
            proximaAcaoAtivacao,
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
      }
    );

    test(
      "não consulta ativação nem próxima ação quando o dashboard principal falha",
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
      }
    );
  }
);
