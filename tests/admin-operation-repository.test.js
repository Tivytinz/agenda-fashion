jest.mock("../src/db/db", () => ({
  query: jest.fn()
}));

const db = require("../src/db/db");
const repository = require("../src/repositories/adminOperationRepository");

describe("adminOperationRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("usa parâmetros para busca e estado de usuários", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [] });

    const search = "%' OR TRUE --";

    await repository.listarUsuarios({
      busca: search,
      status: "desativado",
      limite: 25,
      offset: 0
    });

    expect(db.query).toHaveBeenCalledTimes(2);
    for (const [sql] of db.query.mock.calls) {
      expect(sql).not.toContain(search);
    }
    expect(db.query.mock.calls[0][1]).toEqual([
      search,
      "desativado"
    ]);
    expect(db.query.mock.calls[1][1]).toEqual([
      search,
      "desativado",
      25,
      0
    ]);
    expect(db.query.mock.calls[1][0]).toContain(
      "encerrado_definitivo_em"
    );
    expect(db.query.mock.calls[1][0]).toContain(
      "usuarios_administradores"
    );
  });

  test("usa parâmetros para busca e estado de negócios", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [] });

    const search = "%' OR TRUE --";

    await repository.listarNegocios({
      busca: search,
      status: "publicado",
      limite: 25,
      offset: 0
    });

    expect(db.query).toHaveBeenCalledTimes(2);
    for (const [sql] of db.query.mock.calls) {
      expect(sql).not.toContain(search);
    }
    expect(db.query.mock.calls[0][1]).toEqual([
      search,
      "publicado"
    ]);
    expect(db.query.mock.calls[1][1]).toEqual([
      search,
      "publicado",
      25,
      0
    ]);
    expect(db.query.mock.calls[1][0]).toContain(
      "despublicado_manual_em"
    );
    expect(db.query.mock.calls[1][0]).toContain(
      "arquivado_em"
    );
  });

  test("usa parâmetros para busca e status de agendamentos", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await repository.listarAgendamentos({
      busca: "Maria",
      status: "falta",
      limite: 10,
      offset: 20
    });

    expect(db.query.mock.calls[0][1]).toEqual(["Maria", "falta"]);
    expect(db.query.mock.calls[1][1]).toEqual([
      "Maria",
      "falta",
      10,
      20
    ]);
    expect(db.query.mock.calls[1][0]).toContain(
      "status_atendimento_em"
    );
    expect(db.query.mock.calls[1][0]).toContain(
      "motivo_cancelamento"
    );
  });
});
