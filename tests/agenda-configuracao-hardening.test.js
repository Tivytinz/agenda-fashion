jest.mock(
  "../src/repositories/agendaConfiguracaoRepository",
  () => ({
    buscarVinculoAtivoPorPapel:
      jest.fn(),
    buscarConfiguracao:
      jest.fn(),
    buscarPoliticaCancelamentoNegocio:
      jest.fn(),
    atualizarPoliticaCancelamentoNegocio:
      jest.fn(),
    criarConfiguracao:
      jest.fn(),
    atualizarConfiguracao:
      jest.fn(),
    marcarConfigurada:
      jest.fn(),
    listarHorarios:
      jest.fn(),
    salvarHorario:
      jest.fn(),
    executarTransacao:
      jest.fn(),
  })
);

const repository = require(
  "../src/repositories/agendaConfiguracaoRepository"
);

const service = require(
  "../src/services/agendaConfiguracaoService"
);

const horarios = Array.from(
  {
    length: 7,
  },
  (
    _valor,
    diaSemana
  ) => ({
    diaSemana,
    trabalha:
      diaSemana > 0,
    horaInicio:
      diaSemana > 0
        ? "08:00"
        : null,
    horaFim:
      diaSemana > 0
        ? "18:00"
        : null,
    intervaloInicio:
      diaSemana > 0
        ? "12:00"
        : null,
    intervaloFim:
      diaSemana > 0
        ? "13:00"
        : null,
  })
);

function horarioBanco(
  horario
) {
  return {
    id:
      horario.diaSemana + 1,
    dia_semana:
      horario.diaSemana,
    trabalha:
      horario.trabalha,
    hora_inicio:
      horario.horaInicio,
    hora_fim:
      horario.horaFim,
    intervalo_inicio:
      horario.intervaloInicio,
    intervalo_fim:
      horario.intervaloFim,
  };
}

describe(
  "Configuração atômica da agenda",
  () => {
    const client = {
      query:
        jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();

      repository
        .executarTransacao
        .mockImplementation(
          async (callback) =>
            callback(client)
        );

      repository
        .buscarVinculoAtivoPorPapel
        .mockResolvedValue({
          id: 7,
          negocio_id: 11,
          papel: "dono",
        });

      repository
        .buscarConfiguracao
        .mockResolvedValue({
          profissional_id: 7,
          configurado_em: null,
        });

      repository
        .buscarPoliticaCancelamentoNegocio
        .mockResolvedValue({
          antecedencia_cancelamento:
            24,
        });

      repository
        .atualizarPoliticaCancelamentoNegocio
        .mockResolvedValue({
          antecedencia_cancelamento:
            24,
        });

      repository
        .atualizarConfiguracao
        .mockResolvedValue({
          profissional_id: 7,
          duracao_padrao: 60,
          configurado_em: null,
        });

      repository
        .marcarConfigurada
        .mockResolvedValue({
          profissional_id: 7,
          duracao_padrao: 60,
          configurado_em:
            "2026-08-28T22:00:00.000Z",
        });

      repository
        .salvarHorario
        .mockImplementation(
          async (dados) =>
            horarioBanco(
              dados
            )
        );

    });

    test(
      "consulta o status sem criar configuração ou horários",
      async () => {
        repository
          .buscarConfiguracao
          .mockResolvedValue({
            profissional_id: 7,
            configurado_em:
              "2026-08-28T22:00:00.000Z",
          });

        const resultado =
          await service
            .buscarStatusConfiguracao({
              usuarioId: 7,
            });

        expect(
          resultado
        ).toEqual({
          configurada: true,
          configurado_em:
            "2026-08-28T22:00:00.000Z",
          origem_horarios: "padrao_af",
          personalizada: false,
        });

        expect(
          repository
            .criarConfiguracao
        ).not.toHaveBeenCalled();

        expect(
          repository
            .salvarHorario
        ).not.toHaveBeenCalled();

        expect(
          repository
            .executarTransacao
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "salva configuração e sete dias na mesma transação",
      async () => {
        const resultado =
          await service
            .salvarMinhaConfiguracao({
              usuarioId: 7,
              duracaoPadrao: 60,
              intervaloMinutos: 10,
              antecedenciaAgendamento: 2,
              antecedenciaCancelamento: 24,
              horarios,
            });

        expect(
          repository
            .executarTransacao
        ).toHaveBeenCalledTimes(1);

        expect(
          repository
            .buscarVinculoAtivoPorPapel
        ).toHaveBeenCalledWith(
          7,
          "dono",
          client
        );

        expect(
          repository
            .buscarConfiguracao
        ).toHaveBeenCalledWith(
          7,
          11,
          client
        );

        expect(
          repository
            .salvarHorario
        ).toHaveBeenCalledTimes(7);

        for (
          const chamada
          of repository
            .salvarHorario
            .mock.calls
        ) {
          expect(
            chamada[0].negocioId
          ).toBe(11);

          expect(
            chamada[1]
          ).toBe(client);
        }

        expect(
          repository
            .marcarConfigurada
        ).toHaveBeenCalledWith(
          7,
          11,
          client
        );

        expect(
          repository
            .marcarConfigurada
            .mock.invocationCallOrder[0]
        ).toBeGreaterThan(
          Math.max(
            ...repository
              .salvarHorario
              .mock.invocationCallOrder
          )
        );

        expect(
          resultado.configuracao
            .configurado_em
        ).toBeTruthy();

        expect(
          resultado.mensagem
        ).toBe(
          "Horários personalizados com sucesso."
        );

        expect(
          resultado.publicacao
        ).toBeNull();

        expect(
          resultado.horarios
        ).toHaveLength(7);
      }
    );

    test(
      "somente a dona altera a política de cancelamento do negócio",
      async () => {
        repository
          .buscarPoliticaCancelamentoNegocio
          .mockResolvedValue({
            antecedencia_cancelamento:
              24,
          });

        repository
          .atualizarPoliticaCancelamentoNegocio
          .mockResolvedValue({
            antecedencia_cancelamento:
              12,
          });

        const resultado =
          await service
            .salvarMinhaConfiguracao({
              usuarioId: 7,
              contexto: "dono",
              duracaoPadrao: 60,
              intervaloMinutos: 10,
              antecedenciaAgendamento: 2,
              antecedenciaCancelamento: 12,
              horarios,
            });

        expect(
          repository
            .atualizarPoliticaCancelamentoNegocio
        ).toHaveBeenCalledWith(
          11,
          12,
          client
        );

        expect(
          resultado.configuracao
            .antecedencia_cancelamento
        ).toBe(12);
      }
    );

    test(
      "profissional não altera a política mesmo enviando outro valor",
      async () => {
        repository
          .buscarVinculoAtivoPorPapel
          .mockResolvedValue({
            id: 8,
            negocio_id: 11,
            papel: "profissional",
          });

        repository
          .buscarPoliticaCancelamentoNegocio
          .mockResolvedValue({
            antecedencia_cancelamento:
              12,
          });

        repository
          .buscarConfiguracao
          .mockResolvedValue({
            profissional_id: 8,
            configurado_em:
              "2026-09-27T22:00:00.000Z",
            origem_horarios:
              "personalizado",
          });

        repository
          .atualizarConfiguracao
          .mockResolvedValue({
            profissional_id: 8,
            duracao_padrao: 60,
            configurado_em:
              "2026-09-27T22:00:00.000Z",
          });

        repository
          .marcarConfigurada
          .mockResolvedValue({
            profissional_id: 8,
            duracao_padrao: 60,
            configurado_em:
              "2026-09-27T22:00:00.000Z",
            origem_horarios:
              "personalizado",
          });

        const resultado =
          await service
            .salvarMinhaConfiguracao({
              usuarioId: 8,
              contexto: "profissional",
              duracaoPadrao: 60,
              intervaloMinutos: 10,
              antecedenciaAgendamento: 2,
              antecedenciaCancelamento: 0,
              horarios,
            });

        expect(
          repository
            .atualizarPoliticaCancelamentoNegocio
        ).not.toHaveBeenCalled();

        expect(
          repository
            .atualizarConfiguracao
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            profissionalId: 8,
            negocioId: 11,
            antecedenciaCancelamento:
              12,
          }),
          client
        );

        expect(
          resultado.configuracao
            .antecedencia_cancelamento
        ).toBe(12);
      }
    );

    test(
      "permite salvar uma disponibilidade sem dia ativo sem bloquear a publicação",
      async () => {
        const horariosFechados = horarios.map(
          (horario) => ({
            ...horario,
            trabalha: false,
            horaInicio: null,
            horaFim: null,
            intervaloInicio: null,
            intervaloFim: null,
          })
        );

        await expect(
          service.salvarMinhaConfiguracao({
            usuarioId: 7,
            duracaoPadrao: 60,
            intervaloMinutos: 10,
            antecedenciaAgendamento: 2,
            antecedenciaCancelamento: 24,
            horarios: horariosFechados,
          })
        ).resolves.toMatchObject({
          mensagem: "Horários personalizados com sucesso.",
          publicacao: null,
        });

        expect(
          repository.atualizarConfiguracao
        ).toHaveBeenCalled();
        expect(
          repository.salvarHorario
        ).toHaveBeenCalledTimes(7);
        expect(
          repository.marcarConfigurada
        ).toHaveBeenCalled();
      }
    );

    test(
      "permite fechar todos os dias em uma agenda já confirmada",
      async () => {
        repository.buscarConfiguracao.mockResolvedValue({
          profissional_id: 7,
          configurado_em: "2026-08-28T22:00:00.000Z",
          origem_horarios: "personalizado",
        });

        const horariosFechados = horarios.map(
          (horario) => ({
            ...horario,
            trabalha: false,
            horaInicio: null,
            horaFim: null,
            intervaloInicio: null,
            intervaloFim: null,
          })
        );

        await expect(
          service.salvarMinhaConfiguracao({
            usuarioId: 7,
            duracaoPadrao: 60,
            intervaloMinutos: 10,
            antecedenciaAgendamento: 2,
            antecedenciaCancelamento: 24,
            horarios: horariosFechados,
          })
        ).resolves.toMatchObject({
          mensagem:
            "Horários atualizados com sucesso.",
        });

        expect(
          repository.salvarHorario
        ).toHaveBeenCalledTimes(7);
      }
    );

    test(
      "não permite conta sem vínculo ativo",
      async () => {
        repository
          .buscarVinculoAtivoPorPapel
          .mockResolvedValue(null);

        await expect(
          service
            .salvarMinhaConfiguracao({
              usuarioId: 7,
              duracaoPadrao: 60,
              intervaloMinutos: 10,
              antecedenciaAgendamento: 2,
              antecedenciaCancelamento: 24,
              horarios,
            })
        ).rejects.toMatchObject({
          statusCode: 403,
        });

        expect(
          repository
            .atualizarConfiguracao
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "propaga falha de um dia para a transação executar rollback",
      async () => {
        repository
          .salvarHorario
          .mockImplementation(
            async (dados) => {
              if (
                dados.diaSemana ===
                3
              ) {
                throw new Error(
                  "Falha simulada"
                );
              }

              return horarioBanco(
                dados
              );
            }
          );

        await expect(
          service
            .salvarMinhaConfiguracao({
              usuarioId: 7,
              duracaoPadrao: 60,
              intervaloMinutos: 10,
              antecedenciaAgendamento: 2,
              antecedenciaCancelamento: 24,
              horarios,
            })
        ).rejects.toThrow(
          "Falha simulada"
        );

        expect(
          repository
            .marcarConfigurada
        ).not.toHaveBeenCalled();

      }
    );
  }
);
