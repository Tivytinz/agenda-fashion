jest.mock("../src/db/db", () => ({
  query: jest.fn(),
}));

const db = require("../src/db/db");
const agendaContextoRepository = require(
  "../src/repositories/agendaContextoRepository"
);
const agendaRepository = require(
  "../src/repositories/agendaRepository"
);

describe("contexto explícito da agenda profissional", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [] });
  });

  test("resolve somente vínculo ativo com papel profissional", async () => {
    await agendaContextoRepository.buscarVinculoProfissionalAtivo(7);

    const [sql, parametros] = db.query.mock.calls[0];

    expect(sql).toContain("un.papel = 'profissional'");
    expect(sql).toContain("un.ativo = TRUE");
    expect(sql).not.toContain("WHEN un.papel = 'dono'");
    expect(parametros).toEqual([7]);
  });

  test("endpoint compartilhado pode restringir a busca ao papel profissional", async () => {
    await agendaRepository
      .buscarVinculoUsuarioNegocio(
        7,
        "profissional"
      );

    const [sql, parametros] =
      db.query.mock.calls[0];

    expect(sql).toContain(
      "OR un.papel = $2"
    );
    expect(parametros).toEqual([
      7,
      "profissional",
    ]);
  });

  test("notificações profissionais filtram também pelo negócio validado", async () => {
    await agendaRepository.contarNotificacoesAgendaProfissional(
      7,
      22
    );

    const [sql, parametros] =
      db.query.mock.calls[0];

    expect(sql).toContain(
      "profissional_id = $1"
    );
    expect(sql).toContain(
      "negocio_id = $2"
    );
    expect(parametros).toEqual([
      7,
      22,
    ]);
  });

  test("resolve operações pelo negócio do próprio agendamento", async () => {
    await agendaContextoRepository.buscarVinculoOperacionalDoAgendamento({
      agendamentoId: 91,
      usuarioId: 7,
    });

    const [sql, parametros] = db.query.mock.calls[0];

    expect(sql).toContain("un.negocio_id = a.negocio_id");
    expect(sql).toContain("un.usuario_id = $2");
    expect(sql).toContain("WHERE a.id = $1");
    expect(parametros).toEqual([91, 7]);
  });

  test("usa negocio validado como parâmetro para decidir quais detalhes podem ser expostos", async () => {
    await agendaContextoRepository.listarAgendamentosProfissionalPorPeriodo({
      profissionalId: 7,
      negocioId: 20,
      dataInicio: "2026-09-17",
      dataFim: "2026-09-24",
    });

    const [sql, parametros] = db.query.mock.calls[0];

    expect(sql).toContain("a.negocio_id = $2");
    expect(sql).toContain(
      "negocio_contexto.id = $2"
    );
    expect(sql).toContain(
      "AT TIME ZONE"
    );
    expect(sql).not.toContain("WITH contexto AS");
    expect(parametros).toEqual([
      7,
      20,
      "2026-09-17",
      "2026-09-24",
    ]);
  });
});
