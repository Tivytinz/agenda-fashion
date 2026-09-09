const fs = require("fs");
const path = require("path");
const db = require("../src/db/db");
const {
  buscarReceita,
  buscarVisaoGeral,
} = require("../src/repositories/adminAnalyticsV2Repository");

const migration = fs.readFileSync(
  path.join(
    __dirname,
    "../database/migrations/066_reconciliar_schema_admin_analytics_v2.sql"
  ),
  "utf8"
);

describe("Admin Analytics V2 repository - schema reconciliado", () => {
  afterAll(() => db.end());

  test("Visão geral e Receita executam as queries reais após reconciliar o schema runtime", async () => {
    // A suíte possui testes de compatibilidade com schemas legados que podem
    // remover colunas canônicas do schema público. Reaplicar a migration aqui
    // reproduz exatamente o contrato do deploy antes de exercitar o repository
    // real, sem depender da ordem global dos testes.
    await db.query(migration);

    const colunasReconciliadas = await db.query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (
           (table_name = 'negocios' AND column_name = 'primeira_publicacao_em')
           OR (table_name = 'pagamentos' AND column_name = 'assinatura_id')
         )
       ORDER BY table_name, column_name`
    );

    expect(colunasReconciliadas.rows).toEqual([
      { table_name: "negocios", column_name: "primeira_publicacao_em" },
      { table_name: "pagamentos", column_name: "assinatura_id" },
    ]);

    await expect(buscarVisaoGeral("today")).resolves.toEqual(
      expect.objectContaining({
        periodo: "today",
        sessoes: expect.anything(),
        usuarios_ativos: expect.anything(),
        negocios_publicados: expect.anything(),
        pagamentos_confirmados: expect.anything(),
      })
    );

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
