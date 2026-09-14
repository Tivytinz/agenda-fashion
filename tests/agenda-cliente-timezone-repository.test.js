jest.mock("../src/db/db", () => ({
  query: jest.fn(),
}));

const agendaPublicaRepository = require(
  "../src/repositories/agendaPublicaRepository"
);

describe("agenda do cliente com timezone", () => {
  test("bloqueia somente a linha de agendamento ao buscar com negócio em LEFT JOIN", async () => {
    const executor = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    await agendaPublicaRepository.buscarAgendamentoCliente(
      15,
      9,
      executor,
      { bloquear: true }
    );

    const [sql, parametros] = executor.query.mock.calls[0];

    expect(sql).toContain("LEFT JOIN negocios n");
    expect(sql).toContain("FOR UPDATE OF a");
    expect(sql).not.toMatch(/FOR UPDATE\s*(?:$|;)/m);
    expect(parametros).toEqual([15, 9]);
  });

  test("status de meus agendamentos usa o fuso do negócio com fallback histórico", async () => {
    const db = require("../src/db/db");
    db.query.mockResolvedValue({ rows: [] });

    await agendaPublicaRepository.listarMeusAgendamentos(9);

    const [sql, parametros] = db.query.mock.calls[0];

    expect(sql).toContain("n.fuso_horario");
    expect(sql).toContain("America/Sao_Paulo");
    expect(sql).toContain("NOW() AT TIME ZONE");
    expect(parametros).toEqual([9]);
  });
});
