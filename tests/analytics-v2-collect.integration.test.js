const { randomUUID } = require("node:crypto");
const db = require("../src/db/db");
const { coletar } = require("../src/services/analyticsV2Service");

describe("Analytics V2 collect - integração", () => {
  let visitorUuid = null;

  afterEach(async () => {
    if (!visitorUuid) return;

    await db.query(
      "DELETE FROM analytics_visitantes WHERE visitor_uuid = $1::UUID",
      [visitorUuid]
    );

    visitorUuid = null;
  });

  afterAll(() => db.end());

  test("persiste sequence do page_view na coluna sequencia", async () => {
    visitorUuid = randomUUID();
    const sessionUuid = randomUUID();
    const viewUuid = randomUUID();
    const occurredAt = new Date().toISOString();

    const resultado = await coletar({
      usuarioId: null,
      body: {
        visitorUuid,
        sessionUuid,
        device: {
          type: "desktop",
          browser: "Jest",
          browserMajor: "1",
          os: "test",
        },
        acquisition: {
          landingPage: "/",
        },
        items: [
          {
            type: "page_view",
            occurredAt,
            viewUuid,
            sequence: 7,
            pageKey: "home",
            routeTemplate: "/",
          },
        ],
      },
    });

    expect(resultado).toEqual(
      expect.objectContaining({
        recebido: true,
        gravados: 1,
        sessionUuid,
      })
    );

    const visualizacao = await db.query(
      `
      SELECT v.sequencia, s.session_uuid
      FROM analytics_visualizacoes_tela v
      INNER JOIN analytics_sessoes s ON s.id = v.sessao_id
      WHERE v.view_uuid = $1::UUID
      `,
      [viewUuid]
    );

    expect(visualizacao.rows).toEqual([
      {
        sequencia: 7,
        session_uuid: sessionUuid,
      },
    ]);
  });
});
