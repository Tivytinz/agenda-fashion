jest.mock(
  "../src/services/agendamentoLifecycleService",
  () => ({
    avaliarAgendamento: jest.fn(),
  })
);

const agendamentoLifecycleService = require(
  "../src/services/agendamentoLifecycleService"
);
const {
  avaliarAgendamento,
} = require(
  "../src/controllers/agendamentoLifecycleController"
);

function criarResposta() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe(
  "agendamentoLifecycleController.avaliarAgendamento",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "preserva o contrato de avaliação com o lifecycle canônico",
      async () => {
        const resultado = {
          mensagem:
            "Avaliação salva com sucesso.",
          avaliacao: 5,
        };

        agendamentoLifecycleService
          .avaliarAgendamento
          .mockResolvedValue(
            resultado
          );

        const req = {
          user: { id: 17 },
          params: { id: "42" },
          body: { avaliacao: 5 },
        };
        const res =
          criarResposta();
        const next =
          jest.fn();

        await avaliarAgendamento(
          req,
          res,
          next
        );

        expect(
          agendamentoLifecycleService
            .avaliarAgendamento
        ).toHaveBeenCalledWith({
          clienteId: 17,
          agendamentoId: "42",
          avaliacao: 5,
        });
        expect(
          res.json
        ).toHaveBeenCalledWith(
          resultado
        );
        expect(
          next
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "encaminha erro operacional ao middleware global",
      async () => {
        const erro =
          Object.assign(
            new Error(
              "Só é possível avaliar um atendimento marcado como realizado."
            ),
            { status: 400 }
          );

        agendamentoLifecycleService
          .avaliarAgendamento
          .mockRejectedValue(
            erro
          );

        const req = {
          user: { id: 17 },
          params: { id: "42" },
          body: { avaliacao: 5 },
        };
        const res =
          criarResposta();
        const next =
          jest.fn();

        await avaliarAgendamento(
          req,
          res,
          next
        );

        expect(
          next
        ).toHaveBeenCalledTimes(
          1
        );
        expect(
          next
        ).toHaveBeenCalledWith(
          erro
        );
        expect(
          res.status
        ).not.toHaveBeenCalled();
        expect(
          res.json
        ).not.toHaveBeenCalled();
      }
    );
  }
);
