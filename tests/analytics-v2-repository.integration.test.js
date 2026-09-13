const db = require("../src/db/db");
const {
  upsertVisitante,
  upsertSessao,
  registrarVisualizacao,
} = require("../src/repositories/analyticsV2Repository");

const VISITOR_UUID = "7bd13f95-2df5-4c1d-86b2-d30204ba91d1";
const SESSION_UUID = "dd22eaf4-c58c-4a63-b68b-cd74dc194d3d";
const VIEW_UUID = "087bdc5b-7bf7-4d05-b1e2-d79cf69db6c0";
const OCCURRED_AT = "2026-09-13T12:00:00.000Z";

describe("Analytics V2 repository - contrato de sequência", () => {
  let visitanteId;
  let sessaoId;

  beforeAll(async () => {
    await db.query(
      "DELETE FROM analytics_visitantes WHERE visitor_uuid = $1::UUID",
      [VISITOR_UUID]
    );

    const visitante = await upsertVisitante({
      visitorUuid: VISITOR_UUID,
      occurredAt: OCCURRED_AT,
    });

    const sessao = await upsertSessao({
      sessionUuid: SESSION_UUID,
      visitanteId: visitante.id,
      usuarioId: null,
      occurredAt: OCCURRED_AT,
      deviceType: "desktop",
      browserFamily: "Chromium",
      browserMajor: "152",
      osFamily: "Windows",
    });

    visitanteId = visitante.id;
    sessaoId = sessao.id;
  });

  afterAll(async () => {
    if (visitanteId) {
      await db.query(
        "DELETE FROM analytics_visitantes WHERE id = $1",
        [visitanteId]
      );
    }
    await db.end();
  });

  test("persiste sequence do contrato JavaScript na coluna sequencia", async () => {
    const visualizacao = await registrarVisualizacao({
      viewUuid: VIEW_UUID,
      sessaoId,
      sequence: 7,
      pageKey: "business_profile",
      routeTemplate: "/negocio/:slug",
      targetBusinessId: null,
      targetServiceId: null,
      occurredAt: OCCURRED_AT,
    });

    expect(visualizacao).toEqual(
      expect.objectContaining({
        id: expect.anything(),
      })
    );

    const persistida = await db.query(
      `
      SELECT sequencia
      FROM analytics_visualizacoes_tela
      WHERE view_uuid = $1::UUID
      `,
      [VIEW_UUID]
    );

    expect(persistida.rows[0]?.sequencia).toBe(7);
  });
});
