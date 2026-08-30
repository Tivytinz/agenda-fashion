jest.mock(
  "../src/services/dashboardService",
  () => ({
    buscarDashboardDono:
      jest.fn(),
    buscarDashboardProfissional:
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
  "../src/services/dashboardCustomerOriginService",
  () => ({
    buscarOrigemClientes:
      jest.fn(),
  })
);

const dashboardService = require(
  "../src/services/dashboardService"
);
const dashboardActivationService = require(
  "../src/services/dashboardActivationService"
);
const dashboardController = require(
  "../src/controllers/dashboardController"
);

describe(
  "dashboardController ativação",
  () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    test(
      "anexa estado canônico ao dashboard autorizado do dono",
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

        const req = {
          user: {
            id: 7,
          },
          query: {
            periodo: "7dias",
          },
        };
        const res = {
          json: jest.fn(),
        };
        const next = jest.fn();

        await dashboardController
          .buscarDashboardDono(
            req,
            res,
            next
          );

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
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            ativacao: {
              negocio_publicado: true,
              agenda_configurada: true,
              primeiro_agendamento_recebido: false,
            },
          })
        );
        expect(next).not.toHaveBeenCalled();
      }
    );
  }
);
