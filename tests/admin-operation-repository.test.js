jest.mock("../src/db/db", () => ({
  query: jest.fn()
}));

const db = require("../src/db/db");
const repository = require("../src/repositories/adminOperationRepository");

describe("adminOperationRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [] });
  });

  test("usa parâmetro para busca de negócios", async () => {
    const search = "%' OR TRUE --";

    await repository.listarNegocios({
      busca: search,
      limite: 25,
      offset: 0
    });

    expect(db.query).toHaveBeenCalledTimes(2);
    for (const [sql] of db.query.mock.calls) {
      expect(sql).not.toContain(search);
    }
    expect(db.query.mock.calls[0][1]).toEqual([search]);
    expect(db.query.mock.calls[1][1]).toEqual([search, 25, 0]);
  });

  test("usa parâmetros para busca e status de agendamentos", async () => {
    jest.clearAllMocks();
    db.query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await repository.listarAgendamentos({
      busca: "Maria",
      status: "cancelado",
      limite: 10,
      offset: 20
    });

    expect(db.query.mock.calls[0][1]).toEqual(["Maria", "cancelado"]);
    expect(db.query.mock.calls[1][1]).toEqual(["Maria", "cancelado", 10, 20]);
  });
});
