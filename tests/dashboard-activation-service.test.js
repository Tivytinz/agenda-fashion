jest.mock(
  "../src/repositories/dashboardActivationRepository",
  () => ({
    buscarEstadoAtivacao:
      jest.fn(),
  })
);

const dashboardActivationRepository = require(
  "../src/repositories/dashboardActivationRepository"
);
const dashboardActivationService = require(
  "../src/services/dashboardActivationService"
);

describe(
  "dashboardActivationService",
  () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    test(
      "normaliza somente verdades explícitas do banco",
      async () => {
        dashboardActivationRepository
          .buscarEstadoAtivacao
          .mockResolvedValue({
            possui_servico_ativo: true,
            negocio_publicado: true,
            agenda_configurada: true,
            primeiro_agendamento_recebido: false,
          });

        await expect(
          dashboardActivationService
            .buscarAtivacaoNegocio({
              negocioId: "12",
            })
        ).resolves.toEqual({
          possui_servico_ativo: true,
          negocio_publicado: true,
          agenda_configurada: true,
          primeiro_agendamento_recebido: false,
        });

        expect(
          dashboardActivationRepository
            .buscarEstadoAtivacao
        ).toHaveBeenCalledWith(12);
      }
    );

    test(
      "mantém sinais ausentes como falso",
      async () => {
        dashboardActivationRepository
          .buscarEstadoAtivacao
          .mockResolvedValue({
            possui_servico_ativo: 1,
            negocio_publicado: "true",
            agenda_configurada: null,
            primeiro_agendamento_recebido: undefined,
          });

        await expect(
          dashboardActivationService
            .buscarAtivacaoNegocio({
              negocioId: 12,
            })
        ).resolves.toEqual({
          possui_servico_ativo: false,
          negocio_publicado: false,
          agenda_configurada: false,
          primeiro_agendamento_recebido: false,
        });
      }
    );

    test(
      "não consulta o banco para identificador inválido",
      async () => {
        await expect(
          dashboardActivationService
            .buscarAtivacaoNegocio({
              negocioId: null,
            })
        ).resolves.toEqual({
          possui_servico_ativo: false,
          negocio_publicado: false,
          agenda_configurada: false,
          primeiro_agendamento_recebido: false,
        });

        expect(
          dashboardActivationRepository
            .buscarEstadoAtivacao
        ).not.toHaveBeenCalled();
      }
    );
  }
);
