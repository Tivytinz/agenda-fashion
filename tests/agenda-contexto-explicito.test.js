jest.mock("../src/db/db", () => ({
  query: jest.fn(),
}));

const db = require("../src/db/db");
const agendaContextoRepository = require(
  "../src/repositories/agendaContextoRepository"
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

  test("usa negocio validado como parâmetro para decidir quais detalhes podem ser expostos", async () => {
    await agendaContextoRepository.listarAgendamentosProfissionalPorPeriodo({
      profissionalId: 7,
      negocioId: 20,
      dataInicio: "2026-09-17",
      dataFim: "2026-09-24",
    });

    const [sql, parametros] = db.query.mock.calls[0];

    expect(sql).toContain("a.negocio_id = $2");
    expect(sql).not.toContain("WITH contexto AS");
    expect(parametros).toEqual([
      7,
      20,
      "2026-09-17",
      "2026-09-24",
    ]);
  });
});
