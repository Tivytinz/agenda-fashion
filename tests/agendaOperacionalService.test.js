jest.mock("../src/services/agendaService", () => ({
  listarAgendaProfissional: jest.fn(),
  buscarAgendaGeral: jest.fn(),
}));

jest.mock("../src/repositories/agendaRepository", () => ({
  buscarNegocioDono: jest.fn(),
  buscarBloqueiosProfissionaisPorPeriodo: jest.fn(),
}));

jest.mock("../src/repositories/agendaContextoRepository", () => ({
  listarAgendamentosProfissionalPorPeriodo: jest.fn(),
}));

jest.mock("../src/repositories/agendamentoLifecycleRepository", () => ({
  listarAgendamentosProfissionaisDoNegocioPorPeriodo: jest.fn(),
}));

const agendaService = require("../src/services/agendaService");
const agendaRepository = require("../src/repositories/agendaRepository");
const agendaContextoRepository = require(
  "../src/repositories/agendaContextoRepository"
);
const agendamentoLifecycleRepository = require(
  "../src/repositories/agendamentoLifecycleRepository"
);
const service = require("../src/services/agendaOperacionalService");

describe("agendaOperacionalService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("materializa booking ativo da profissional com cancelamento operacional habilitado", () => {
    const agenda = [
      {
        data: "2026-09-20",
        horarios: [
          { hora: "10:00", status: "disponivel" },
          { hora: "11:00", status: "disponivel" },
        ],
      },
    ];

    const resultado = service.materializarAgendaProfissional(agenda, [
      {
        data: "2026-09-20",
        hora: "10:00",
        status: "confirmado",
        agendamento_id: 101,
        cliente_id: 9,
        cliente: "Cliente Teste",
        servico_id: 4,
        servico: "Manicure",
        pode_marcar_falta: false,
        pode_marcar_realizado: false,
      },
    ]);

    expect(resultado[0].horarios).toEqual([
      expect.objectContaining({
        hora: "10:00",
        status: "confirmado",
        agendamento_id: 101,
        pode_cancelar: true,
      }),
      expect.objectContaining({
        hora: "11:00",
        status: "disponivel",
      }),
    ]);
  });

  test("mantém cancelamento operacional disponível mesmo após liberar marcação de falta", () => {
    const resultado = service.materializarAgendaProfissional(
      [{ data: "2026-09-20", horarios: [] }],
      [
        {
          data: "2026-09-20",
          hora: "10:00",
          status: "agendado",
          agendamento_id: 102,
          pode_marcar_falta: true,
          pode_marcar_realizado: false,
        },
      ]
    );

    expect(resultado[0].horarios[0]).toMatchObject({
      agendamento_id: 102,
      status: "agendado",
      pode_cancelar: true,
      pode_marcar_falta: true,
    });
  });

  test("item redigido sem agendamento_id nunca expõe ação de cancelamento", () => {
    const resultado = service.materializarAgendaGeral(
      [
        {
          data: "2026-09-20",
          profissionais: [
            { id: 7, horarios: [] },
          ],
        },
      ],
      [
        {
          profissional_id: 7,
          data: "2026-09-20",
          hora: "14:00",
          status: "confirmado",
          agendamento_id: null,
          cliente: null,
          servico: null,
          pode_marcar_falta: false,
          pode_marcar_realizado: false,
        },
      ],
      []
    );

    expect(resultado[0].profissionais[0].horarios[0]).toMatchObject({
      hora: "14:00",
      status: "confirmado",
      agendamento_id: null,
      pode_cancelar: false,
    });
  });

  test("listarAgendaProfissional usa o período e o negócio explícito para carregar compromissos persistidos", async () => {
    agendaService.listarAgendaProfissional.mockResolvedValue({
      profissional: { id: 7 },
      agenda: [
        { data: "2026-09-20", horarios: [] },
        { data: "2026-09-22", horarios: [] },
      ],
    });
    agendaContextoRepository
      .listarAgendamentosProfissionalPorPeriodo
      .mockResolvedValue([
        {
          data: "2026-09-21",
          hora: "09:30",
          status: "agendado",
          agendamento_id: 103,
          pode_marcar_falta: false,
          pode_marcar_realizado: false,
        },
      ]);

    const resultado = await service.listarAgendaProfissional({
      profissionalId: 7,
      negocioId: 55,
    });

    expect(
      agendaContextoRepository
        .listarAgendamentosProfissionalPorPeriodo
    ).toHaveBeenCalledWith({
      profissionalId: 7,
      negocioId: 55,
      dataInicio: "2026-09-20",
      dataFim: "2026-09-22",
    });
    expect(resultado.agenda).toHaveLength(2);
  });

  test("buscarAgendaGeral mantém o negócio como escopo da consulta operacional", async () => {
    agendaService.buscarAgendaGeral.mockResolvedValue({
      agenda: [
        {
          data: "2026-09-20",
          profissionais: [
            { id: 7, horarios: [] },
            { id: 8, horarios: [] },
          ],
        },
      ],
    });
    agendaRepository.buscarNegocioDono.mockResolvedValue({
      negocio_id: 55,
    });
    agendamentoLifecycleRepository
      .listarAgendamentosProfissionaisDoNegocioPorPeriodo
      .mockResolvedValue([]);
    agendaRepository.buscarBloqueiosProfissionaisPorPeriodo.mockResolvedValue([]);

    await service.buscarAgendaGeral({ usuarioId: 3 });

    expect(
      agendamentoLifecycleRepository
        .listarAgendamentosProfissionaisDoNegocioPorPeriodo
    ).toHaveBeenCalledWith({
      negocioId: 55,
      profissionalIds: [7, 8],
      dataInicio: "2026-09-20",
      dataFim: "2026-09-20",
    });
    expect(
      agendaRepository.buscarBloqueiosProfissionaisPorPeriodo
    ).toHaveBeenCalledWith(
      55,
      [7, 8],
      "2026-09-20",
      "2026-09-20"
    );
  });
});
