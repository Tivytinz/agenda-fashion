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

    test.each([
      [true, false, "SEM_HORARIOS", true],
      [true, false, "DURACAO_INCOMPATIVEL", true],
      [true, true, "SEM_HORARIOS", false],
      ["true", false, "SEM_HORARIOS", false],
      [true, false, "SEM_PROFISSIONAL_HABILITADA", false],
      [true, false, undefined, false],
    ])("normaliza contexto da equipe: %s/%s/%s", async (equipe, disponivel, motivo, esperado) => {
      dashboardActivationRepository.buscarEstadoAtivacao.mockResolvedValue({
        revisar_horarios_na_equipe: equipe, possui_disponibilidade_agendavel: disponivel, motivo_indisponibilidade: motivo,
      });
      const result = await dashboardActivationService.buscarAtivacaoNegocio({ negocioId: 12 });
      expect(result.revisar_horarios_na_equipe).toBe(esperado);
    });

    test.each(["SEM_PROFISSIONAL_HABILITADA", "SEM_HORARIOS", "DURACAO_INCOMPATIVEL", "desconhecido", undefined])(
      "normaliza o diagnóstico de indisponibilidade: %s", async (motivo) => {
        dashboardActivationRepository.buscarEstadoAtivacao.mockResolvedValue({
          possui_disponibilidade_agendavel: false, motivo_indisponibilidade: motivo,
        });
        const resultado = await dashboardActivationService.buscarAtivacaoNegocio({ negocioId: 12 });
        expect(resultado.motivo_indisponibilidade).toBe(
          ["SEM_PROFISSIONAL_HABILITADA", "SEM_HORARIOS", "DURACAO_INCOMPATIVEL"].includes(motivo) ? motivo : null
        );
      }
    );

    test("não mantém diagnóstico de bloqueio quando existe disponibilidade", async () => {
      dashboardActivationRepository.buscarEstadoAtivacao.mockResolvedValue({
        possui_disponibilidade_agendavel: true, motivo_indisponibilidade: "SEM_HORARIOS",
      });
      const resultado = await dashboardActivationService.buscarAtivacaoNegocio({ negocioId: 12 });
      expect(resultado.motivo_indisponibilidade).toBeNull();
    });

    test.each([true, false, "true", 1, undefined])(
      "deriva a pausa apenas de booleano verdadeiro retornado pelo repository: %s",
      async (sinal) => {
        dashboardActivationRepository.buscarEstadoAtivacao.mockResolvedValue({
          negocio_publicado: false,
          publicacao_pausada_manualmente: sinal,
        });
        const resultado = await dashboardActivationService.buscarAtivacaoNegocio({ negocioId: 12 });
        expect(resultado.publicacao_pausada_manualmente).toBe(sinal === true);
      }
    );

    test(
      "normaliza somente verdades explícitas do banco",
      async () => {
        dashboardActivationRepository
          .buscarEstadoAtivacao
          .mockResolvedValue({
            possui_servico: true,
            possui_servico_ativo: true,
            negocio_publicado: true,
            agenda_configurada: true,
            possui_disponibilidade_agendavel: true,
            primeiro_agendamento_recebido: false,
          });

        await expect(
          dashboardActivationService
            .buscarAtivacaoNegocio({
              negocioId: "12",
            })
        ).resolves.toEqual({
          possui_servico: true,
          possui_servico_ativo: true,
          negocio_publicado: true,
          publicacao_pausada_manualmente: false,
          agenda_configurada: true,
          possui_disponibilidade_agendavel: true,
          motivo_indisponibilidade: null,
          revisar_horarios_na_equipe: false,
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
            possui_servico: 1,
            possui_servico_ativo: 1,
            negocio_publicado: "true",
            agenda_configurada: null,
            possui_disponibilidade_agendavel: null,
            primeiro_agendamento_recebido: undefined,
          });

        await expect(
          dashboardActivationService
            .buscarAtivacaoNegocio({
              negocioId: 12,
            })
        ).resolves.toEqual({
          possui_servico: false,
          possui_servico_ativo: false,
          negocio_publicado: false,
          publicacao_pausada_manualmente: false,
          agenda_configurada: false,
          possui_disponibilidade_agendavel: false,
          motivo_indisponibilidade: null,
          revisar_horarios_na_equipe: false,
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
          possui_servico: false,
          possui_servico_ativo: false,
          negocio_publicado: false,
          publicacao_pausada_manualmente: false,
          agenda_configurada: false,
          possui_disponibilidade_agendavel: false,
          motivo_indisponibilidade: null,
          revisar_horarios_na_equipe: false,
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
