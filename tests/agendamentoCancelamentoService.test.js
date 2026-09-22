jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(),
}));

jest.mock("../src/repositories/agendamentoCancelamentoRepository", () => ({
  buscarPoliticaPublica: jest.fn(),
  buscarAgendamentoClienteParaCancelar: jest.fn(),
  buscarAgendamentoVisitanteParaCancelar: jest.fn(),
  buscarAgendamentoOperacionalParaCancelar: jest.fn(),
  cancelarAgendamentoCliente: jest.fn(),
  cancelarAgendamentoVisitante: jest.fn(),
  cancelarAgendamentoOperacional: jest.fn(),
}));

jest.mock("../src/services/bookingAnalyticsService", () => ({
  registrarBookingCreated: jest.fn(),
  registrarBookingRescheduled: jest.fn(),
  registrarBookingCancelled: jest.fn(),
  registrarBookingCompleted: jest.fn(),
  registrarBookingNoShow: jest.fn(),
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
const bookingAnalyticsService = require(
  "../src/services/bookingAnalyticsService"
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
    repository.cancelarAgendamentoOperacional.mockResolvedValue({
      id: 10,
      status: "cancelado",
      cancelado_por: 5,
      cancelamento_origem: "negocio",
      motivo_cancelamento: "Profissional indisponível",
    });
    whatsappMensagemService.enfileirarCancelamento.mockResolvedValue();
    bookingAnalyticsService.registrarBookingCancelled
      .mockResolvedValue({
        event_id: "evento-teste",
      });
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
    expect(
      bookingAnalyticsService.registrarBookingCancelled
    ).toHaveBeenCalledWith({
      agendamentoId: 10,
      actorType: "CLIENT",
      actorId: 12,
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

  test("dona pode cancelar booking futuro sem herdar a antecedência da cliente", async () => {
    repository.buscarAgendamentoOperacionalParaCancelar.mockResolvedValue({
      id: 10,
      negocio_id: 4,
      profissional_id: 8,
      status: "confirmado",
      antecedencia_cancelamento_horas: 168,
      data: "2026-09-16",
      horario: "16:00",
      fuso_horario: "America/Sao_Paulo",
      papel_executor: "dono",
    });

    await expect(service.cancelarAgendamentoOperacional({
      agendamentoId: 10,
      negocioId: 4,
      usuarioId: 5,
      motivoTipo: "profissional_indisponivel",
      motivo: null,
    })).resolves.toMatchObject({
      ja_cancelado: false,
      agendamento: {
        id: 10,
        status: "cancelado",
        cancelado_por: 5,
        cancelamento_origem: "negocio",
      },
    });

    expect(repository.cancelarAgendamentoOperacional).toHaveBeenCalledWith({
      agendamentoId: 10,
      usuarioId: 5,
      motivo: "Profissional indisponível",
      executor: client,
    });
    expect(whatsappMensagemService.enfileirarCancelamento).toHaveBeenCalledWith({
      executor: client,
      agendamentoId: 10,
    });
  });

  test("CA-AG-11: permite cancelamento operacional após o início com motivo válido", async () => {
    obterDataHoraNoFuso.mockReturnValue({
      data: "2026-09-16",
      hora: "10:30",
    });

    repository.buscarAgendamentoOperacionalParaCancelar.mockResolvedValue({
      id: 10,
      negocio_id: 4,
      profissional_id: 8,
      status: "confirmado",
      data: "2026-09-16",
      horario: "10:00",
      fuso_horario: "America/Sao_Paulo",
      papel_executor: "dono",
    });

    await expect(service.cancelarAgendamentoOperacional({
      agendamentoId: 10,
      negocioId: 4,
      usuarioId: 5,
      motivoTipo: "atendimento_interrompido",
      motivo: "Falha elétrica durante o atendimento",
    })).resolves.toMatchObject({
      ja_cancelado: false,
      agendamento: {
        status: "cancelado",
      },
    });

    expect(repository.cancelarAgendamentoOperacional).toHaveBeenCalledWith({
      agendamentoId: 10,
      usuarioId: 5,
      motivo:
        "Atendimento interrompido antes da conclusão: Falha elétrica durante o atendimento",
      executor: client,
    });
  });

  test("CA-AG-12: ausência dentro de 15 min não vira CANCELADO", async () => {
    obterDataHoraNoFuso.mockReturnValue({
      data: "2026-09-16",
      hora: "10:14",
    });

    repository.buscarAgendamentoOperacionalParaCancelar.mockResolvedValue({
      id: 10,
      negocio_id: 4,
      profissional_id: 8,
      status: "confirmado",
      data: "2026-09-16",
      horario: "10:00",
      fuso_horario: "America/Sao_Paulo",
      papel_executor: "dono",
    });

    await expect(service.cancelarAgendamentoOperacional({
      agendamentoId: 10,
      negocioId: 4,
      usuarioId: 5,
      motivoTipo: "cliente_ausente",
    })).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/15 minutos/i),
    });

    expect(repository.cancelarAgendamentoOperacional).not.toHaveBeenCalled();
  });

  test("ausência após 15 min é direcionada para NAO_COMPARECEU", async () => {
    obterDataHoraNoFuso.mockReturnValue({
      data: "2026-09-16",
      hora: "10:15",
    });

    repository.buscarAgendamentoOperacionalParaCancelar.mockResolvedValue({
      id: 10,
      negocio_id: 4,
      profissional_id: 8,
      status: "confirmado",
      data: "2026-09-16",
      horario: "10:00",
      fuso_horario: "America/Sao_Paulo",
      papel_executor: "dono",
    });

    await expect(service.cancelarAgendamentoOperacional({
      agendamentoId: 10,
      negocioId: 4,
      usuarioId: 5,
      motivoTipo: "cliente_ausente",
    })).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/NAO_COMPARECEU/i),
    });

    expect(repository.cancelarAgendamentoOperacional).not.toHaveBeenCalled();
  });

  test("profissional não pode cancelar booking atribuído a outra profissional", async () => {
    repository.buscarAgendamentoOperacionalParaCancelar.mockResolvedValue({
      id: 10,
      negocio_id: 4,
      profissional_id: 8,
      status: "agendado",
      data: "2026-09-16",
      horario: "16:00",
      fuso_horario: "America/Sao_Paulo",
      papel_executor: "profissional",
    });

    await expect(service.cancelarAgendamentoOperacional({
      agendamentoId: 10,
      negocioId: 4,
      usuarioId: 9,
    })).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/próprios agendamentos/i),
    });

    expect(repository.cancelarAgendamentoOperacional).not.toHaveBeenCalled();
    expect(whatsappMensagemService.enfileirarCancelamento).not.toHaveBeenCalled();
  });

  test("repetição após cancelamento operacional é idempotente", async () => {
    repository.buscarAgendamentoOperacionalParaCancelar.mockResolvedValue({
      id: 10,
      negocio_id: 4,
      profissional_id: 8,
      status: "cancelado",
      data: "2026-09-16",
      horario: "16:00",
      fuso_horario: "America/Sao_Paulo",
      papel_executor: "dono",
      cancelado_em: "2026-09-16T10:01:00.000Z",
      cancelado_por: 5,
      cancelamento_origem: "negocio",
      motivo_cancelamento: "Imprevisto",
    });

    await expect(service.cancelarAgendamentoOperacional({
      agendamentoId: 10,
      negocioId: 4,
      usuarioId: 5,
    })).resolves.toMatchObject({
      ja_cancelado: true,
      agendamento: {
        status: "cancelado",
        cancelado_por: 5,
      },
    });

    expect(repository.cancelarAgendamentoOperacional).not.toHaveBeenCalled();
    expect(whatsappMensagemService.enfileirarCancelamento).not.toHaveBeenCalled();
  });

  test("motivo operacional acima do limite é rejeitado antes da transação", async () => {
    await expect(service.cancelarAgendamentoOperacional({
      agendamentoId: 10,
      negocioId: 4,
      usuarioId: 5,
      motivo: "x".repeat(301),
    })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/300 caracteres/i),
    });

    expect(db.executarTransacao).not.toHaveBeenCalled();
  });
});
