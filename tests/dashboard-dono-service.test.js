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

const dashboardService = require(
  "../src/services/dashboardService"
);
const dashboardActivationService = require(
  "../src/services/dashboardActivationService"
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
      "combina dashboard autorizado com estado canônico de ativação",
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

        dashboardActivationService
          .buscarAtivacaoNegocio
          .mockResolvedValue({
            negocio_publicado: true,
            agenda_configurada: true,
            primeiro_agendamento_recebido: false,
          });

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
          ativacao: {
            negocio_publicado: true,
            agenda_configurada: true,
            primeiro_agendamento_recebido: false,
          },
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
      }
    );

    test(
      "não consulta ativação quando o dashboard principal falha",
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
      }
    );
  }
);
