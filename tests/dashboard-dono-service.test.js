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
  "../src/services/copilotActivationService",
  () => ({
    resolverCopilotAtivacao:
      jest.fn(),
  })
);

const dashboardService = require(
  "../src/services/dashboardService"
);
const dashboardActivationService = require(
  "../src/services/dashboardActivationService"
);
const copilotActivationService = require(
  "../src/services/copilotActivationService"
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
      "combina dashboard autorizado com ativação e Copilot canônicos",
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
        const copilotAtivacao = {
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
        copilotActivationService
          .resolverCopilotAtivacao
          .mockReturnValue(
            copilotAtivacao
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
          copilot_ativacao:
            copilotAtivacao,
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
          copilotActivationService
            .resolverCopilotAtivacao
        ).toHaveBeenCalledWith(
          ativacao
        );
      }
    );

    test(
      "não consulta ativação nem Copilot quando o dashboard principal falha",
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
          copilotActivationService
            .resolverCopilotAtivacao
        ).not.toHaveBeenCalled();
      }
    );
  }
);
