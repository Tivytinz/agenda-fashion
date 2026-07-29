jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(),
}));

jest.mock("../src/repositories/agendaPublicaRepository");
jest.mock("../src/repositories/agendaConfiguracaoRepository", () => ({}));
jest.mock("../src/services/agendaDisponibilidadeService", () => ({
  horarioEstaDisponivel: jest.fn(),
}));
jest.mock("../src/services/notificationService", () => ({
  novoAgendamento: jest.fn(),
}));
jest.mock("../src/services/whatsappMensagemService", () => ({
  enfileirarNovoAgendamento: jest.fn(),
  enfileirarCancelamento: jest.fn(),
}));
jest.mock("../src/services/planoService", () => ({
  verificarCapacidadePlano: jest.fn(),
}));

const db = require("../src/db/db");
const agendaPublicaRepository = require(
  "../src/repositories/agendaPublicaRepository"
);
const agendaDisponibilidadeService = require(
  "../src/services/agendaDisponibilidadeService"
);
const planoService = require("../src/services/planoService");
const whatsappMensagemService = require(
  "../src/services/whatsappMensagemService"
);
const agendamentoPublicoService = require(
  "../src/services/agendamentoPublicoService"
);

describe("Limite durante a criação do agendamento", () => {
  test("valida o mês escolhido dentro da transação", async () => {
    const client = {
      query: jest.fn(),
    };

    db.executarTransacao.mockImplementation(
      async (callback) => callback(client)
    );

    planoService.verificarCapacidadePlano.mockResolvedValue({
      utilizados: 9,
      capacidade_agendamentos: 10,
    });

    agendaPublicaRepository.bloquearAgendaProfissional.mockResolvedValue();
    agendaDisponibilidadeService.horarioEstaDisponivel.mockResolvedValue(true);
    agendaPublicaRepository.criarAgendamento.mockResolvedValue({
      id: 99,
    });

    const resultado = await agendamentoPublicoService.criarAgendamento({
      data: "2026-08-15",
      horario: "14:00",
      profissionalId: 2,
      clienteId: 3,
      clienteNome: "Cliente",
      clienteWhatsapp: "62999999999",
      servicoId: 4,
      negocioId: 5,
      duracaoServico: 60,
      servicoNome: "Manicure",
      profissionalNome: "Profissional",
    });

    expect(resultado.id).toBe(99);
    expect(planoService.verificarCapacidadePlano).toHaveBeenCalledWith(
      5,
      client,
      {
        bloquear: true,
        dataReferencia: "2026-08-15",
      }
    );

    expect(
      whatsappMensagemService
        .enfileirarNovoAgendamento
    ).toHaveBeenCalledWith({
      executor:
        client,
      agendamentoId:
        99,
    });
  });
});
