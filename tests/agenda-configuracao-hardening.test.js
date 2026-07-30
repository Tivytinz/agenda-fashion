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
        });

      repository
        .atualizarConfiguracao
        .mockResolvedValue({
          profissional_id: 7,
          duracao_padrao: 60,
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
      }
    );
  }
);
