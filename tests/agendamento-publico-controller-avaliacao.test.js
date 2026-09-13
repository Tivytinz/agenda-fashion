jest.mock(
  "../src/services/agendamentoPublicoService",
  () => ({
    avaliarAgendamento: jest.fn(),
  })
);

jest.mock(
  "../src/services/planoService",
  () => ({
    buscarUsoPlano: jest.fn(),
  })
);

jest.mock(
  "../src/utils/registrador",
  () => ({
    erro: jest.fn(),
  })
);

const agendaPublicaService = require(
  "../src/services/agendamentoPublicoService"
);
const {
  avaliarAgendamento,
} = require(
  "../src/controllers/agendamentoPublicoController"
);

function criarResposta() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe(
  "agendamentoPublicoController.avaliarAgendamento",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "preserva o contrato de avaliação com o service",
      async () => {
        const resultado = {
          mensagem: "Avaliação salva com sucesso.",
          avaliacao: 5,
        };

        agendaPublicaService
          .avaliarAgendamento
          .mockResolvedValue(resultado);

        const req = {
          user: { id: 17 },
          params: { id: "42" },
          body: { avaliacao: 5 },
        };
        const res = criarResposta();
        const next = jest.fn();

        await avaliarAgendamento(
          req,
          res,
          next
        );

        expect(
          agendaPublicaService
            .avaliarAgendamento
        ).toHaveBeenCalledWith({
          clienteId: 17,
          agendamentoId: "42",
          avaliacao: 5,
        });
        expect(res.json)
          .toHaveBeenCalledWith(resultado);
        expect(next)
          .not.toHaveBeenCalled();
      }
    );

    test(
      "encaminha erro operacional ao middleware global",
      async () => {
        const erro = Object.assign(
          new Error(
            "Só é possível avaliar serviços já realizados."
          ),
          { status: 400 }
        );

        agendaPublicaService
          .avaliarAgendamento
          .mockRejectedValue(erro);

        const req = {
          user: { id: 17 },
          params: { id: "42" },
          body: { avaliacao: 5 },
        };
        const res = criarResposta();
        const next = jest.fn();

        await avaliarAgendamento(
          req,
          res,
          next
        );

        expect(next)
          .toHaveBeenCalledTimes(1);
        expect(next)
          .toHaveBeenCalledWith(erro);
        expect(res.status)
          .not.toHaveBeenCalled();
        expect(res.json)
          .not.toHaveBeenCalled();
      }
    );
  }
);
