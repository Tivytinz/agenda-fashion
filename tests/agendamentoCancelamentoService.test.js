jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(),
}));

jest.mock("../src/repositories/agendamentoCancelamentoRepository", () => ({
  buscarPoliticaPublica: jest.fn(),
  buscarAgendamentoClienteParaCancelar: jest.fn(),
  buscarAgendamentoVisitanteParaCancelar: jest.fn(),
  cancelarAgendamentoCliente: jest.fn(),
  cancelarAgendamentoVisitante: jest.fn(),
}));

jest.mock("../src/services/whatsappMensagemService", () => ({
  enfileirarCancelamento: jest.fn(),
}));

jest.mock("../src/utils/agendamentoVisitante", () => ({
  validarAcessoVisitante: jest.fn(),
}));

jest.mock("../src/utils/fusoHorario", () => ({
  obterDataHoraNoFuso: jest.fn(),
}));

const db = require("../src/db/db");
const repository = require(
  "../src/repositories/agendamentoCancelamentoRepository"
);
const whatsappMensagemService = require(
  "../src/services/whatsappMensagemService"
);
const {
  validarAcessoVisitante,
} = require("../src/utils/agendamentoVisitante");
const {
  obterDataHoraNoFuso,
} = require("../src/utils/fusoHorario");
const service = require(
  "../src/services/agendamentoCancelamentoService"
);

describe("agendamentoCancelamentoService", () => {
  const client = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();

    db.executarTransacao.mockImplementation(
      async (callback) => callback(client)
    );

    obterDataHoraNoFuso.mockReturnValue({
      data: "2026-09-16",
      hora: "10:00",
    });

    validarAcessoVisitante.mockReturnValue(true);

    repository.cancelarAgendamentoCliente.mockResolvedValue({
      id: 10,
      status: "cancelado",
    });
    repository.cancelarAgendamentoVisitante.mockResolvedValue({
      id: 10,
      status: "cancelado",
    });
    whatsappMensagemService.enfileirarCancelamento.mockResolvedValue();
  });

  test("retorna a política pública vigente do profissional", async () => {
    repository.buscarPoliticaPublica.mockResolvedValue({
      negocio_id: 4,
      profissional_id: 8,
      antecedencia_cancelamento_horas: 2,
    });

    await expect(service.buscarPoliticaPublica({
      slug: "studio-teste",
      profissionalId: 8,
    })).resolves.toEqual({
      antecedencia_horas: 2,
    });
  });

  test("bloqueia confirmação quando a política exibida ficou desatualizada", async () => {
    repository.buscarPoliticaPublica.mockResolvedValue({
      negocio_id: 4,
      profissional_id: 8,
      antecedencia_cancelamento_horas: 24,
    });

    await expect(service.validarPoliticaEsperada({
      slug: "studio-teste",
      profissionalId: 8,
      antecedenciaEsperada: 2,
    })).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/política de cancelamento foi atualizada/i),
    });
  });

  test("cancelamento autenticado usa a antecedência congelada no booking", async () => {
    repository.buscarAgendamentoClienteParaCancelar.mockResolvedValue({
      id: 10,
      negocio_id: 4,
      profissional_id: 8,
      cliente_id: 12,
      status: "agendado",
      antecedencia_cancelamento_horas: 2,
      data: "2026-09-16",
      horario: "16:00",
      fuso_horario: "America/Sao_Paulo",
    });

    await expect(service.cancelarAgendamentoCliente({
      agendamentoId: 10,
      clienteId: 12,
    })).resolves.toMatchObject({
      id: 10,
      status: "cancelado",
    });

    expect(repository.cancelarAgendamentoCliente).toHaveBeenCalledWith({
      agendamentoId: 10,
      clienteId: 12,
      executor: client,
    });
    expect(whatsappMensagemService.enfileirarCancelamento).toHaveBeenCalledWith({
      executor: client,
      agendamentoId: 10,
    });
  });

  test("não troca o snapshot por uma regra atual mais permissiva", async () => {
    repository.buscarAgendamentoClienteParaCancelar.mockResolvedValue({
      id: 10,
      negocio_id: 4,
      profissional_id: 8,
      cliente_id: 12,
      status: "agendado",
      antecedencia_cancelamento_horas: 24,
      data: "2026-09-16",
      horario: "16:00",
      fuso_horario: "America/Sao_Paulo",
    });

    await expect(service.cancelarAgendamentoCliente({
      agendamentoId: 10,
      clienteId: 12,
    })).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/24 horas/i),
    });

    expect(repository.cancelarAgendamentoCliente).not.toHaveBeenCalled();
  });

  test("visitante inválido é rejeitado antes de abrir transação", async () => {
    validarAcessoVisitante.mockReturnValue(false);

    await expect(service.cancelarAgendamentoVisitante({
      agendamentoId: 10,
      acessoVisitante: "token-invalido",
    })).rejects.toMatchObject({
      statusCode: 403,
      message: "Acesso do agendamento inválido.",
    });

    expect(db.executarTransacao).not.toHaveBeenCalled();
  });

  test("visitante válido usa o mesmo snapshot e enfileira cancelamento", async () => {
    repository.buscarAgendamentoVisitanteParaCancelar.mockResolvedValue({
      id: 10,
      negocio_id: 4,
      profissional_id: 8,
      cliente_id: null,
      status: "confirmado",
      antecedencia_cancelamento_horas: 0,
      data: "2026-09-16",
      horario: "16:00",
      fuso_horario: "America/Sao_Paulo",
    });

    await expect(service.cancelarAgendamentoVisitante({
      agendamentoId: 10,
      acessoVisitante: "capability-valida",
    })).resolves.toMatchObject({
      id: 10,
      status: "cancelado",
    });

    expect(repository.cancelarAgendamentoVisitante).toHaveBeenCalledWith({
      agendamentoId: 10,
      executor: client,
    });
    expect(whatsappMensagemService.enfileirarCancelamento).toHaveBeenCalledWith({
      executor: client,
      agendamentoId: 10,
    });
  });
});
