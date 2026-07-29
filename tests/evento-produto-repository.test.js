jest.mock("../src/db/db", () => ({
  query: jest.fn(),
}));

const db = require("../src/db/db");
const eventoProdutoRepository = require(
  "../src/repositories/eventoProdutoRepository"
);

describe("repositório de eventos do produto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({
      rows: [{ id: 77 }],
    });
  });

  test("descarta referências opcionais inexistentes sem perder o evento", async () => {
    const resultado = await eventoProdutoRepository.registrar({
      nome: "agendamento_cancelado",
      pagina: "meus_agendamentos",
      missao: "acompanhar_agendamentos",
      sessaoId: "sessao_produto_123",
      usuarioId: null,
      negocioId: 14,
      propriedades: { agendamento_id: 32 },
    });

    expect(resultado).toEqual({ id: 77 });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT id\n            FROM negocios"),
      [
        "agendamento_cancelado",
        "meus_agendamentos",
        "acompanhar_agendamentos",
        "sessao_produto_123",
        null,
        14,
        JSON.stringify({ agendamento_id: 32 }),
      ]
    );
  });
});
