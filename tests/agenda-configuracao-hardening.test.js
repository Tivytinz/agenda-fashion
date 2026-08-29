jest.mock(
  "../src/repositories/agendaConfiguracaoRepository",
  () => ({
    buscarProfissionalAtivo:
      jest.fn(),
    buscarConfiguracao:
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
        .buscarProfissionalAtivo
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
            .buscarProfissionalAtivo
        ).toHaveBeenCalledWith(
          7,
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
            chamada[1]
          ).toBe(client);
        }

        expect(
          repository
            .marcarConfigurada
        ).toHaveBeenCalledWith(
          7,
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
          "Sua agenda está pronta para receber clientes."
        );

        expect(
          resultado.horarios
        ).toHaveLength(7);
      }
    );

    test(
      "não permite conta sem vínculo ativo",
      async () => {
        repository
          .buscarProfissionalAtivo
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
