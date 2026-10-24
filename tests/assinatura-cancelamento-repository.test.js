jest.mock("../src/db/db", () => ({ query: jest.fn() }));
const repository = require("../src/repositories/assinaturaRepository");
const client = { query: jest.fn() };
const expected = { assinaturaId: 20, negocioId: 7, asaasSubscriptionId: "sub_20",
  reativacaoTentativa: 0, acessoAte: "2099-12-01", observacoes: "teste" };
beforeEach(() => jest.clearAllMocks());

test.each([
  { asaasSubscriptionId: null }, { reativacaoTentativa: undefined },
  { reativacaoTentativa: null }, { reativacaoTentativa: -1 },
  { reativacaoTentativa: 1.5 }, { reativacaoTentativa: "1" },
])("cancelamento sem identidade confiável não executa SQL: %j", async (invalid) => {
  await expect(repository.registrarCancelamento(client, { ...expected, ...invalid }))
    .rejects.toThrow("Identidade da recorrência de cancelamento inválida.");
  expect(client.query).not.toHaveBeenCalled();
});
