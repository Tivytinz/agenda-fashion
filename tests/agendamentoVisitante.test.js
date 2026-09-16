jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(),
}));

jest.mock(
  "../src/repositories/agendaConfiguracaoRepository",
  () => ({
    buscarConfiguracao: jest.fn(),
  })
);

jest.mock(
  "../src/services/whatsappMensagemService",
  () => ({
    enfileirarCancelamento: jest.fn(),
  })
);

jest.mock("../src/utils/fusoHorario", () => ({
  obterDataHoraNoFuso: jest.fn(() => ({
    data: "2026-09-15",
    hora: "10:00",
  })),
}));

const db = require("../src/db/db");
const agendaConfiguracaoRepository = require(
  "../src/repositories/agendaConfiguracaoRepository"
);
const whatsappMensagemService = require(
  "../src/services/whatsappMensagemService"
);
const {
  gerarAcessoVisitante,
  validarAcessoVisitante,
} = require("../src/utils/agendamentoVisitante");
const {
  cancelarAgendamentoVisitante,
} = require("../src/services/agendamentoVisitanteService");

describe("acesso seguro do agendamento visitante", () => {
  const segredoAnterior = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET =
      "segredo-de-teste-com-entropia-suficiente";
  });

  afterAll(() => {
    process.env.JWT_SECRET = segredoAnterior;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    agendaConfiguracaoRepository
      .buscarConfiguracao
      .mockResolvedValue({
        antecedencia_cancelamento: 0,
      });
  });

  test("gera uma capability vinculada ao id e rejeita outro agendamento", () => {
    const acesso = gerarAcessoVisitante(101);

    expect(acesso).toMatch(
      /^[A-Za-z0-9_-]{43}$/
    );
    expect(
      validarAcessoVisitante(101, acesso)
    ).toBe(true);
    expect(
      validarAcessoVisitante(102, acesso)
    ).toBe(false);
  });

  test("rejeita capability ausente ou adulterada", () => {
    expect(
      validarAcessoVisitante(101, "")
    ).toBe(false);
    expect(
      validarAcessoVisitante(
        101,
        "x".repeat(43)
      )
    ).toBe(false);
  });

  test("cancela somente o agendamento visitante correspondente", async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{
            id: 101,
            profissional_id: 7,
            cliente_id: null,
            status: "agendado",
            data: "2026-09-16",
            horario: "10:00",
            fuso_horario:
              "America/Sao_Paulo",
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 101,
            status: "cancelado",
          }],
        }),
    };

    db.executarTransacao.mockImplementation(
      (callback) => callback(client)
    );

    const resultado =
      await cancelarAgendamentoVisitante({
        agendamentoId: 101,
        acessoVisitante:
          gerarAcessoVisitante(101),
      });

    expect(resultado.mensagem).toMatch(
      /cancelado com sucesso/i
    );
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(
      whatsappMensagemService
        .enfileirarCancelamento
    ).toHaveBeenCalledWith({
      executor: client,
      agendamentoId: 101,
    });
  });

  test("não consulta nem altera o banco com capability de outro id", async () => {
    await expect(
      cancelarAgendamentoVisitante({
        agendamentoId: 102,
        acessoVisitante:
          gerarAcessoVisitante(101),
      })
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      db.executarTransacao
    ).not.toHaveBeenCalled();
  });

  test("não permite a rota visitante em agendamento vinculado a uma conta", async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [],
      }),
    };

    db.executarTransacao.mockImplementation(
      (callback) => callback(client)
    );

    await expect(
      cancelarAgendamentoVisitante({
        agendamentoId: 101,
        acessoVisitante:
          gerarAcessoVisitante(101),
      })
    ).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(
      whatsappMensagemService
        .enfileirarCancelamento
    ).not.toHaveBeenCalled();
  });

  test("mantém a regra de antecedência também para visitante", async () => {
    agendaConfiguracaoRepository
      .buscarConfiguracao
      .mockResolvedValue({
        antecedencia_cancelamento: 24,
      });

    const client = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [{
          id: 101,
          profissional_id: 7,
          cliente_id: null,
          status: "agendado",
          data: "2026-09-16",
          horario: "09:00",
          fuso_horario:
            "America/Sao_Paulo",
        }],
      }),
    };

    db.executarTransacao.mockImplementation(
      (callback) => callback(client)
    );

    await expect(
      cancelarAgendamentoVisitante({
        agendamentoId: 101,
        acessoVisitante:
          gerarAcessoVisitante(101),
      })
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(client.query).toHaveBeenCalledTimes(1);
  });
});