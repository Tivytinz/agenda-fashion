jest.mock("../src/db/db", () => ({
  query: jest.fn()
}));

const db = require("../src/db/db");
const repository = require("../src/repositories/perfilNegocioRepository");

describe("perfilNegocioRepository e agenda online", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("catálogo usa o marco configurado_em para sinalizar agenda confirmada", async () => {
    db.query.mockResolvedValue({ rows: [] });

    await repository.listarNegociosPublicos();

    const [sql] = db.query.mock.calls[0];

    expect(sql).toContain("AS agendamento_online_disponivel");
    expect(sql).toContain("ac.configurado_em IS NOT NULL");
    expect(sql).toContain(
      "'agendamento_online_disponivel', n.agendamento_online_disponivel"
    );
  });

  test("perfil público expõe o mesmo sinal sem alterar sua publicação", async () => {
    db.query.mockResolvedValue({
      rows: [{
        id: 7,
        slug: "studio-aurora",
        publicado: true,
        agendamento_online_disponivel: false
      }]
    });

    const negocio = await repository.buscarNegocioPorSlug("studio-aurora");
    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toContain("AS agendamento_online_disponivel");
    expect(sql).toContain("ac.configurado_em IS NOT NULL");
    expect(params).toEqual(["studio-aurora"]);
    expect(negocio).toEqual(expect.objectContaining({
      publicado: true,
      agendamento_online_disponivel: false
    }));
  });
});
