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
const agendaOperacionalService = require("../src/services/agendaOperacionalService");

describe("agenda operacional confiável", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("materializa compromisso persistido mesmo quando o dia atual está fechado", async () => {
    agendaService.listarAgendaProfissional.mockResolvedValue({
      configuracao: {
        duracao_padrao: 60,
        intervalo_minutos: 0,
      },
      agenda: [
        {
          data: "2026-09-16",
          trabalha: false,
          horarios: [],
        },
      ],
    });

    agendaContextoRepository
      .listarAgendamentosProfissionalPorPeriodo.mockResolvedValue([
        {
          agendamento_id: 91,
          profissional_id: 7,
          negocio_id: 3,
          data: "2026-09-16",
          hora: "09:30",
          status: "confirmado",
          cliente_id: 12,
          cliente: "Ana",
          cliente_whatsapp: "62999999999",
          servico_id: 20,
          servico: "Corte",
          valor: "80.00",
          duracao_minutos: 60,
          pode_marcar_falta: false,
          pode_marcar_realizado: false,
        },
      ]);

    const resultado = await agendaOperacionalService.listarAgendaProfissional({
      profissionalId: 7,
      negocioId: 3,
    });

    expect(resultado.agenda[0]).toMatchObject({
      data: "2026-09-16",
      trabalha: false,
    });
    expect(resultado.agenda[0].horarios).toEqual([
      expect.objectContaining({
        hora: "09:30",
        status: "confirmado",
        agendamento_id: 91,
        cliente: "Ana",
        servico: "Corte",
      }),
    ]);
  });

  test("restaura o status persistido quando a agenda-base inferiu realizado pelo horário", async () => {
    agendaService.listarAgendaProfissional.mockResolvedValue({
      agenda: [
        {
          data: "2026-09-15",
          trabalha: true,
          horarios: [
            {
              data: "2026-09-15",
              hora: "08:00",
              status: "realizado",
              agendamento_id: 101,
              cliente: "Bia",
              servico: "Manicure",
            },
          ],
        },
      ],
    });

    agendaContextoRepository
      .listarAgendamentosProfissionalPorPeriodo.mockResolvedValue([
        {
          agendamento_id: 101,
          profissional_id: 7,
          negocio_id: 3,
          data: "2026-09-15",
          hora: "08:00",
          status: "agendado",
          cliente_id: 13,
          cliente: "Bia",
          servico_id: 21,
          servico: "Manicure",
          valor: "45.00",
          duracao_minutos: 45,
          pode_marcar_falta: true,
          pode_marcar_realizado: true,
        },
      ]);

    const resultado = await agendaOperacionalService.listarAgendaProfissional({
      profissionalId: 7,
      negocioId: 3,
    });

    expect(resultado.agenda[0].horarios[0]).toMatchObject({
      hora: "08:00",
      status: "agendado",
      agendamento_id: 101,
    });
  });

  test("inclui reserva e bloqueio fora da grade horária fixa da Agenda Geral", async () => {
    agendaService.buscarAgendaGeral.mockResolvedValue({
      agenda: [
        {
          data: "2026-09-16",
          profissionais: [
            {
              id: 7,
              nome: "Carla",
              horarios: [
                { hora: "09:00", status: "livre", cliente: null, servico: null },
                { hora: "10:00", status: "livre", cliente: null, servico: null },
              ],
            },
          ],
        },
      ],
    });

    agendaRepository.buscarNegocioDono.mockResolvedValue({ negocio_id: 3 });
    agendamentoLifecycleRepository
      .listarAgendamentosProfissionaisDoNegocioPorPeriodo.mockResolvedValue([
        {
          agendamento_id: 92,
          profissional_id: 7,
          data: "2026-09-16",
          hora: "09:30",
          status: "agendado",
          cliente: "Dani",
          servico: "Escova",
          pode_marcar_falta: false,
          pode_marcar_realizado: false,
        },
      ]);
    agendaRepository.buscarBloqueiosProfissionaisPorPeriodo.mockResolvedValue([
      {
        id: 44,
        profissional_id: 7,
        data: "2026-09-16",
        hora: "10:30",
      },
    ]);

    const resultado = await agendaOperacionalService.buscarAgendaGeral({
      usuarioId: 1,
    });

    expect(resultado.agenda[0].profissionais[0].horarios).toEqual([
      expect.objectContaining({ hora: "09:00", status: "livre" }),
      expect.objectContaining({
        hora: "09:30",
        status: "agendado",
        cliente: "Dani",
        servico: "Escova",
      }),
      expect.objectContaining({ hora: "10:00", status: "livre" }),
      expect.objectContaining({
        hora: "10:30",
        status: "bloqueado",
        cliente: null,
        servico: null,
      }),
    ]);
  });

  test("mantém ocupação de outro negócio sem expor cliente ou serviço", async () => {
    agendaService.buscarAgendaGeral.mockResolvedValue({
      agenda: [
        {
          data: "2026-09-16",
          profissionais: [
            { id: 7, nome: "Carla", horarios: [] },
          ],
        },
      ],
    });

    agendaRepository.buscarNegocioDono.mockResolvedValue({ negocio_id: 3 });
    agendamentoLifecycleRepository
      .listarAgendamentosProfissionaisDoNegocioPorPeriodo.mockResolvedValue([
        {
          agendamento_id: null,
          profissional_id: 7,
          data: "2026-09-16",
          hora: "14:30",
          status: "agendado",
          cliente: null,
          servico: null,
          pode_marcar_falta: false,
          pode_marcar_realizado: false,
        },
      ]);
    agendaRepository.buscarBloqueiosProfissionaisPorPeriodo.mockResolvedValue([]);

    const resultado = await agendaOperacionalService.buscarAgendaGeral({
      usuarioId: 1,
    });

    expect(resultado.agenda[0].profissionais[0].horarios).toEqual([
      expect.objectContaining({
        hora: "14:30",
        status: "agendado",
        agendamento_id: null,
        cliente: null,
        servico: null,
        pode_marcar_falta: false,
        pode_marcar_realizado: false,
      }),
    ]);
  });
});
