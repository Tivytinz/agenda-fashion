const db = require("../src/db/db");
const {
  buscarJornada,
  buscarReceita,
  buscarVisaoGeral,
} = require("../src/repositories/adminAnalyticsV2Repository");

describe("Admin Analytics V2 repository - regressão de CTE", () => {
  afterAll(() => db.end());

  test("Visão geral resolve negócios, agendamentos e pagamentos nas tabelas físicas", async () => {
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

  test("Jornada expõe o funil pós-publicação sem depender de backfill artificial", async () => {
    await expect(buscarJornada("today")).resolves.toEqual(
      expect.objectContaining({
        periodo: "today",
        posPublicacao: expect.objectContaining({
          negocios_publicados: expect.anything(),
          perfis_compartilhados: expect.anything(),
          visitas_externas_pos_compartilhamento: expect.anything(),
          agendamentos_iniciados_pos_visita: expect.anything(),
          primeiros_agendamentos_validos: expect.anything(),
        }),
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
