const db = require("../src/db/db");
const {
  buscarReceita,
  buscarVisaoGeral,
} = require("../src/repositories/adminAnalyticsV2Repository");

describe("Admin Analytics V2 repository - regressão de CTE", () => {
  afterAll(() => db.end());

  test("Visão geral consulta a tabela de negócios sem shadowing da CTE", async () => {
    await expect(buscarVisaoGeral("today")).resolves.toEqual(
      expect.objectContaining({
        periodo: "today",
        sessoes: expect.anything(),
        usuarios_ativos: expect.anything(),
        negocios_publicados: expect.anything(),
        pagamentos_confirmados: expect.anything(),
      })
    );
  });

  test("Receita consulta pagamentos reais ao calcular primeiros pagamentos", async () => {
    await expect(buscarReceita("today")).resolves.toEqual(
      expect.objectContaining({
        periodo: "today",
        resumo: expect.objectContaining({
          pagamentos_confirmados: expect.anything(),
          receita_total: expect.anything(),
        }),
        planos: expect.any(Array),
      })
    );
  });
});
