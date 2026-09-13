jest.mock("../src/db/db", () => ({
  query: jest.fn()
}));

const db = require("../src/db/db");
const dashboardRepository = require("../src/repositories/dashboardRepository");
const servicosRepository = require("../src/repositories/servicosRepository");
const agendaRepository = require("../src/repositories/agendaRepository");

function esperarPrioridadeDono(sql) {
  expect(sql).toContain("ORDER BY");
  expect(sql).toContain("WHEN un.papel = 'dono' THEN 0");
  expect(sql).toContain("un.created_at ASC");
  expect(sql).toContain("LIMIT 1");
}

describe("Resolução do contexto principal de negócio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [] });
  });

  test("dashboard prioriza vínculo de dono de forma determinística", async () => {
    await dashboardRepository.buscarNegocioDoUsuario(7);

    const [sql, parametros] = db.query.mock.calls[0];

    esperarPrioridadeDono(sql);
    expect(sql).toContain("n.id ASC");
    expect(parametros).toEqual([7]);
  });

  test("serviços usam a mesma prioridade de contexto da sessão", async () => {
    await servicosRepository.buscarNegocioUsuario(8);

    const [sql, parametros] = db.query.mock.calls[0];

    esperarPrioridadeDono(sql);
    expect(sql).toContain("n.id ASC");
    expect(parametros).toEqual([8]);
  });

  test("agenda profissional genérica usa a mesma prioridade de contexto", async () => {
    await agendaRepository.buscarNegocioDoUsuario(9);

    const [sql, parametros] = db.query.mock.calls[0];

    esperarPrioridadeDono(sql);
    expect(sql).toContain("n.id ASC");
    expect(parametros).toEqual([9]);
  });

  test("notificações da agenda usam a mesma prioridade de contexto", async () => {
    await agendaRepository.buscarVinculoUsuarioNegocio(10);

    const [sql, parametros] = db.query.mock.calls[0];

    esperarPrioridadeDono(sql);
    expect(sql).toContain("un.negocio_id ASC");
    expect(parametros).toEqual([10]);
  });
});
