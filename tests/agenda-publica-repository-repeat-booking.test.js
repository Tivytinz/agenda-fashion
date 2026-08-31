jest.mock("../src/db/db", () => ({
  query: jest.fn()
}));

const db = require("../src/db/db");
const repository = require("../src/repositories/agendaPublicaRepository");

describe("agendaPublicaRepository e reagendamento", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("lista o serviço e o profissional originais sem alterar o contrato existente", async () => {
    db.query.mockResolvedValue({
      rows: [{
        id: 21,
        negocio_id: 7,
        servico_id: 12,
        profissional_id: 4,
        slug: "studio-aurora",
        status: "realizado"
      }]
    });

    const resultado = await repository.listarMeusAgendamentos(42);
    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("a.servico_id");
    expect(sql).toContain("a.profissional_id");
    expect(params).toEqual([42]);
    expect(resultado[0]).toEqual(expect.objectContaining({
      servico_id: 12,
      profissional_id: 4
    }));
  });
});
