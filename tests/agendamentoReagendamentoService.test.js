jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(),
}));

jest.mock("../src/repositories/agendamentoReagendamentoRepository", () => ({
  buscarAgendamentoParaReagendar: jest.fn(),
  buscarProfissionalAtivoNoNegocio: jest.fn(),
  atualizarReagendamento: jest.fn(),
  registrarHistoricoReagendamento: jest.fn(),
}));

jest.mock("../src/repositories/profissionalServicosRepository", () => ({
  bloquearElegibilidadeNegocio: jest.fn(),
}));

jest.mock("../src/repositories/agendaPublicaRepository", () => ({
  bloquearAgendaProfissional: jest.fn(),
}));

jest.mock("../src/services/agendaDisponibilidadeService", () => ({
  horarioEstaDisponivel: jest.fn(),
}));

jest.mock("../src/services/whatsappMensagemService", () => ({
  enfileirarReagendamento: jest.fn(),
}));

jest.mock("../src/utils/fusoHorario", () => ({
  obterDataHoraNoFuso: jest.fn(),
}));

const db = require("../src/db/db");
const repository = require(
  "../src/repositories/agendamentoReagendamentoRepository"
);
const agendaPublicaRepository = require(
  "../src/repositories/agendaPublicaRepository"
);
const agendaDisponibilidadeService = require(
  "../src/services/agendaDisponibilidadeService"
);
const whatsappMensagemService = require(
  "../src/services/whatsappMensagemService"
);
const {
  obterDataHoraNoFuso,
} = require("../src/utils/fusoHorario");
const service = require(
  "../src/services/agendamentoReagendamentoService"
);

describe("agendamentoReagendamentoService", () => {
  const client = { query: jest.fn() };

  const base = {
    id: 50,
    negocio_id: 7,
    servico_id: 3,
    profissional_id: 8,
    client_id: 15,
    cliente_id: 20,
    status: "confirmado",
    data: "2026-09-18",
    horario: "10:00",
    servico_nome: "Manicure",
    valor_servico: "70.00",
    duracao_minutos: 60,
    antecedencia_cancelamento_horas: 2,
    atendimento_iniciado_em: null,
    atendimento_iniciado_por: null,
    fuso_horario: "America/Sao_Paulo",
    papel_executor: "profissional",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    db.executarTransacao.mockImplementation(
      async (callback) => callback(client)
    );

    obterDataHoraNoFuso.mockReturnValue({
      data: "2026-09-18",
      hora: "09:00",
    });

    repository.buscarAgendamentoParaReagendar
      .mockResolvedValue({ ...base });

    repository.buscarProfissionalAtivoNoNegocio
      .mockResolvedValue({
        profissional_id: 8,
        papel: "profissional",
        nome: "Ana",
      });

    agendaDisponibilidadeService.horarioEstaDisponivel
      .mockResolvedValue(true);

    repository.atualizarReagendamento
      .mockResolvedValue({
        id: 50,
        negocio_id: 7,
        servico_id: 3,
        profissional_id: 8,
        client_id: 15,
        cliente_id: 20,
        status: "confirmado",
        data: "2026-09-18",
        horario: "14:00",
        servico_nome: "Manicure",
        valor_servico: "70.00",
        duracao_minutos: 60,
        antecedencia_cancelamento_horas: 2,
      });

    repository.registrarHistoricoReagendamento
      .mockResolvedValue({
        id: 90,
      });

    whatsappMensagemService.enfileirarReagendamento
      .mockResolvedValue([]);
  });

  test("CA-AG-16: profissional reage apenas a própria reserva sem trocar responsável", async () => {
    const resultado = await service.reagendarOperacional({
      usuarioId: 8,
      negocioId: 7,
      agendamentoId: 50,
      data: "2026-09-18",
      horario: "14:00",
    });

    expect(resultado.agendamento).toMatchObject({
      id: 50,
      profissional_id: 8,
      servico_id: 3,
      servico_nome: "Manicure",
      valor_servico: "70.00",
      duracao_minutos: 60,
      antecedencia_cancelamento_horas: 2,
    });

    expect(
      agendaPublicaRepository.bloquearAgendaProfissional
    ).toHaveBeenCalledWith(
      client,
      8,
      "2026-09-18"
    );

    expect(
      agendaDisponibilidadeService.horarioEstaDisponivel
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        profissionalId: 8,
        negocioId: 7,
        duracaoServico: 60,
        data: "2026-09-18",
        horario: "14:00",
        agendamentoIgnorarId: 50,
        ignorarAntecedencia: true,
      })
    );

    expect(
      repository.atualizarReagendamento
    ).toHaveBeenCalledWith({
      agendamentoId: 50,
      profissionalId: 8,
      data: "2026-09-18",
      horario: "14:00",
      executor: client,
    });

    expect(
      repository.registrarHistoricoReagendamento
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        agendamentoId: 50,
        actorUserId: 8,
        actorType: "PROFESSIONAL",
        previousProfissionalId: 8,
        newProfissionalId: 8,
        antecedenciaCancelamentoHoras: 2,
      })
    );

    expect(
      whatsappMensagemService.enfileirarReagendamento
    ).toHaveBeenCalledWith({
      executor: client,
      agendamentoId: 50,
    });
  });

  test("CA-AG-16: profissional comum não reage reserva atribuída a outra profissional", async () => {
    repository.buscarAgendamentoParaReagendar
      .mockResolvedValue({
        ...base,
        profissional_id: 9,
      });

    await expect(
      service.reagendarOperacional({
        usuarioId: 8,
        negocioId: 7,
        agendamentoId: 50,
        data: "2026-09-18",
        horario: "14:00",
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/próprios agendamentos/i),
    });

    expect(
      repository.atualizarReagendamento
    ).not.toHaveBeenCalled();
  });

  test("CA-AG-17: proprietária transfere para profissional elegível", async () => {
    repository.buscarAgendamentoParaReagendar
      .mockResolvedValue({
        ...base,
        papel_executor: "dono",
      });

    repository.buscarProfissionalAtivoNoNegocio
      .mockResolvedValue({
        profissional_id: 9,
        papel: "profissional",
        nome: "Bia",
      });

    repository.atualizarReagendamento
      .mockResolvedValue({
        ...base,
        profissional_id: 9,
        data: "2026-09-18",
        horario: "15:00",
      });

    const resultado =
      await service.reagendarOperacional({
        usuarioId: 5,
        negocioId: 7,
        agendamentoId: 50,
        data: "2026-09-18",
        horario: "15:00",
        profissionalId: 9,
      });

    expect(resultado.agendamento.profissional_id)
      .toBe(9);

    expect(
      repository.buscarProfissionalAtivoNoNegocio
    ).toHaveBeenCalledWith({
      profissionalId: 9,
      negocioId: 7,
      servicoId: 3,
      executor: client,
    });

    expect(
      repository.registrarHistoricoReagendamento
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 5,
        actorType: "OWNER",
        previousProfissionalId: 8,
        newProfissionalId: 9,
      })
    );
  });

  test("CA-AG-17: profissional não elegível continua bloqueada", async () => {
    repository.buscarAgendamentoParaReagendar
      .mockResolvedValue({
        ...base,
        papel_executor: "dono",
      });

    repository.buscarProfissionalAtivoNoNegocio
      .mockResolvedValue(null);

    await expect(
      service.reagendarOperacional({
        usuarioId: 5,
        negocioId: 7,
        agendamentoId: 50,
        data: "2026-09-18",
        horario: "15:00",
        profissionalId: 9,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/habilitada para este serviço/i),
    });

    expect(
      repository.atualizarReagendamento
    ).not.toHaveBeenCalled();
  });

  test("CA-AG-18: permite reagendar após o início previsto se o atendimento ainda não começou", async () => {
    obterDataHoraNoFuso.mockReturnValue({
      data: "2026-09-18",
      hora: "10:30",
    });

    const resultado = await service.reagendarOperacional({
      usuarioId: 8,
      negocioId: 7,
      agendamentoId: 50,
      data: "2026-09-18",
      horario: "12:00",
    });

    expect(resultado.agendamento.id).toBe(50);
    expect(
      repository.atualizarReagendamento
    ).toHaveBeenCalled();
  });

  test("CA-AG-19: bloqueia reagendamento depois que o atendimento foi iniciado", async () => {
    obterDataHoraNoFuso.mockReturnValue({
      data: "2026-09-18",
      hora: "10:30",
    });

    repository.buscarAgendamentoParaReagendar
      .mockResolvedValue({
        ...base,
        atendimento_iniciado_em:
          "2026-09-18T13:01:00.000Z",
        atendimento_iniciado_por: 8,
      });

    await expect(
      service.reagendarOperacional({
        usuarioId: 8,
        negocioId: 7,
        agendamentoId: 50,
        data: "2026-09-18",
        horario: "12:00",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/já começou/i),
    });

    expect(
      repository.atualizarReagendamento
    ).not.toHaveBeenCalled();
  });

  test("CA-AG-20: preserva snapshots e recalcula o cutoff a partir do novo início", async () => {
    const resultado = await service.reagendarOperacional({
      usuarioId: 8,
      negocioId: 7,
      agendamentoId: 50,
      data: "2026-09-18",
      horario: "14:00",
    });

    expect(resultado.agendamento).toMatchObject({
      servico_id: 3,
      servico_nome: "Manicure",
      valor_servico: "70.00",
      duracao_minutos: 60,
      antecedencia_cancelamento_horas: 2,
    });

    expect(
      resultado.reagendamento.cancelamento_direto_disponivel
    ).toBe(true);

    expect(
      resultado.reagendamento.cancelamento_limite
    ).toContain("2026-09-18T12:00:00");
  });

  test("CA-AG-21: aceita reagendamento dentro do cutoff e retorna aviso", async () => {
    obterDataHoraNoFuso.mockReturnValue({
      data: "2026-09-18",
      hora: "10:00",
    });

    repository.buscarAgendamentoParaReagendar
      .mockResolvedValue({
        ...base,
        antecedencia_cancelamento_horas: 4,
      });

    repository.atualizarReagendamento
      .mockResolvedValue({
        ...base,
        data: "2026-09-18",
        horario: "12:00",
        antecedencia_cancelamento_horas: 4,
      });

    const resultado = await service.reagendarOperacional({
      usuarioId: 8,
      negocioId: 7,
      agendamentoId: 50,
      data: "2026-09-18",
      horario: "12:00",
    });

    expect(
      resultado.reagendamento.cancelamento_direto_disponivel
    ).toBe(false);

    expect(resultado.mensagem).toMatch(
      /cancelamento direto.*não está disponível/i
    );
  });

  test("rejeita target indisponível antes de alterar a reserva", async () => {
    agendaDisponibilidadeService.horarioEstaDisponivel
      .mockResolvedValue(false);

    await expect(
      service.reagendarOperacional({
        usuarioId: 8,
        negocioId: 7,
        agendamentoId: 50,
        data: "2026-09-18",
        horario: "14:00",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/não está disponível/i),
    });

    expect(
      repository.atualizarReagendamento
    ).not.toHaveBeenCalled();
    expect(
      repository.registrarHistoricoReagendamento
    ).not.toHaveBeenCalled();
  });
});
