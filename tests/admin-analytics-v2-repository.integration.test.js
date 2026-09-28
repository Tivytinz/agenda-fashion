const { randomUUID } = require("crypto");
const db = require("../src/db/db");
const {
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
        clientes_com_agendamento: expect.anything(),
        pagamentos_confirmados: expect.anything(),
      })
    );
  });

  test("conta contas autenticadas distintas sem transformar visitas anônimas em usuários", async () => {
    const antes = await buscarVisaoGeral("today");
    const suffix = randomUUID().slice(0, 12);
    const visitantes = [];
    let usuarioId;

    try {
      const usuario = await db.query(
        `INSERT INTO usuarios (nome, email, senha, whatsapp)
         VALUES ('Teste Admin', $1, 'senha-teste', '62999999999') RETURNING id`,
        [`admin-metrica-${suffix}@example.test`]
      );
      usuarioId = usuario.rows[0].id;

      for (let index = 0; index < 3; index += 1) {
        const visitante = await db.query(
          `INSERT INTO analytics_visitantes
             (visitor_uuid, primeiro_visto_em, ultimo_visto_em)
           VALUES ($1::UUID, NOW(), NOW()) RETURNING id`,
          [randomUUID()]
        );
        visitantes.push(visitante.rows[0].id);
      }

      for (const [visitanteId, contaId] of [
        [visitantes[0], null],
        [visitantes[0], usuarioId],
        [visitantes[1], usuarioId],
        [visitantes[2], null],
      ]) {
        await db.query(
          `INSERT INTO analytics_sessoes
             (session_uuid, visitante_id, usuario_id, iniciada_em, ultima_atividade_em)
           VALUES ($1::UUID, $2, $3, NOW(), NOW())`,
          [randomUUID(), visitanteId, contaId]
        );
      }

      const depois = await buscarVisaoGeral("today");
      expect(depois.sessoes - antes.sessoes).toBe(4);
      expect(depois.usuarios_ativos - antes.usuarios_ativos).toBe(1);
    } finally {
      if (visitantes.length) {
        await db.query("DELETE FROM analytics_visitantes WHERE id = ANY($1::BIGINT[])", [visitantes]);
      }
      if (usuarioId) {
        await db.query("DELETE FROM usuarios WHERE id = $1", [usuarioId]);
      }
    }
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
