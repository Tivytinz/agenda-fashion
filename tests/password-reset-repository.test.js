jest.mock("../src/db/db", () => ({
  executarTransacao: jest.fn(),
  query: jest.fn(),
}));

const db = require("../src/db/db");
const repository = require("../src/repositories/passwordResetRepository");

describe("repositório de recuperação de senha", () => {
  beforeEach(() => jest.clearAllMocks());

  test("serializa solicitações do mesmo usuário antes de trocar o token", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ id: 7 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 9, expira_em: "2026-08-20T12:30:00.000Z" }],
        }),
    };
    db.executarTransacao.mockImplementation((callback) => callback(client));

    await repository.substituirToken({
      usuarioId: 7,
      tokenHash: "a".repeat(64),
      expiraEm: new Date("2026-08-20T12:30:00.000Z"),
    });

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    expect(client.query.mock.calls[0][1]).toEqual([7]);
    expect(client.query.mock.calls[1][0]).toMatch(/UPDATE redefinicoes_senha/);
    expect(client.query.mock.calls[2][0]).toMatch(/INSERT INTO redefinicoes_senha/);
  });

  test("troca a senha e invalida todos os tokens na mesma transação", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ id: 9, usuario_id: 7 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    db.executarTransacao.mockImplementation((callback) => callback(client));

    const resultado = await repository.redefinirSenha({
      tokenHash: "b".repeat(64),
      senhaHash: "senha-hash",
    });

    expect(resultado).toEqual({ usuarioId: 7 });
    expect(client.query.mock.calls[0][0]).toMatch(/expira_em > NOW\(\)/);
    expect(client.query.mock.calls[0][0]).toMatch(/FOR UPDATE OF rs, u/);
    expect(client.query.mock.calls[1][0]).toMatch(/UPDATE usuarios/);
    expect(client.query.mock.calls[2][0]).toMatch(/UPDATE redefinicoes_senha/);
  });
});
