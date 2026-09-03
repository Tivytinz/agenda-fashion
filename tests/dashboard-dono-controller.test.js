jest.mock(
  "../src/services/dashboardService",
  () => ({
    buscarDashboardProfissional:
      jest.fn(),
  })
);

jest.mock(
  "../src/services/dashboardDonoService",
  () => ({
    buscarDashboardDono:
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

const dashboardDonoService = require(
  "../src/services/dashboardDonoService"
);
const dashboardController = require(
  "../src/controllers/dashboardController"
);

describe(
  "dashboardController dono",
  () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    test(
      "delega o caso de uso e devolve o contrato pronto",
      async () => {
        const resultado = {
          periodo: "7dias",
          negocio: {
            negocio_id: 18,
          },
          resumo: {},
          performance: {},
          ativacao: {
            possui_servico_ativo: true,
            negocio_publicado: true,
            agenda_configurada: true,
            primeiro_agendamento_recebido: false,
          },
          copilot_ativacao: {
            estado:
              "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
            concluido: false,
            titulo: "Divulgue seu perfil",
            mensagem:
              "Compartilhe seu perfil.",
            acao: {
              tipo:
                "COMPARTILHAR_PERFIL",
              rotulo:
                "Compartilhar perfil",
            },
          },
        };

        dashboardDonoService
          .buscarDashboardDono
          .mockResolvedValue(
            resultado
          );

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
          dashboardDonoService
            .buscarDashboardDono
        ).toHaveBeenCalledWith({
          usuarioId: 7,
          periodo: "7dias",
        });
        expect(
          res.json
        ).toHaveBeenCalledWith(
          resultado
        );
        expect(next).not.toHaveBeenCalled();
      }
    );
  }
);
