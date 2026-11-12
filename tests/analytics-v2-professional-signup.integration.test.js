const { randomUUID } = require("crypto");
const db = require("../src/db/db");
const { coletar } = require("../src/services/analyticsV2Service");
const { buscarJornada } = require("../src/repositories/adminAnalyticsV2Repository");

describe("Cadastro profissional: coletor → PostgreSQL → Admin/Jornada", () => {
  const visitorUuid = randomUUID();
  const sessionUuid = randomUUID();
  const viewUuid = randomUUID();
  const eventUuids = Array.from({ length: 5 }, () => randomUUID());

  async function cleanup() {
    // Eventos usam FK ON DELETE SET NULL; remover explicitamente evita resíduos.
    await db.query("DELETE FROM analytics_eventos WHERE event_uuid = ANY($1::UUID[])", [eventUuids]);
    await db.query("DELETE FROM analytics_visitantes WHERE visitor_uuid = $1::UUID", [visitorUuid]);
  }

  afterAll(async () => {
    try { await cleanup(); } finally { await db.end(); }
  });

  test("coleta, associa e deduplica eventos; método não infla sessões com duas tentativas", async () => {
    const before = await buscarJornada("today");
    const occurredAt = new Date().toISOString();
    const payload = {
      visitorUuid,
      sessionUuid,
      device: { type: "mobile", browser: "Chromium", browserMajor: "152", os: "Android" },
      acquisition: {},
      items: [
        { type: "page_view", viewUuid, sequence: 1, pageKey: "professional_register", routeTemplate: "/cadastro", occurredAt },
        {
          type: "event", eventUuid: eventUuids[0], viewUuid, schemaVersion: 1,
          name: "professional_signup_started", occurredAt,
          properties: { method: "email", trigger: "form_input" }
        },
        {
          type: "event", eventUuid: eventUuids[1], viewUuid, schemaVersion: 1,
          name: "professional_signup_validation_error", occurredAt,
          properties: { field: "email", reason: "invalid_format", plaintext: "não persistir" }
        },
        {
          type: "event", eventUuid: eventUuids[2], viewUuid, schemaVersion: 1,
          name: "professional_signup_submitted", occurredAt,
          properties: { method: "email" }
        },
        {
          type: "event", eventUuid: eventUuids[3], viewUuid, schemaVersion: 1,
          name: "professional_signup_submitted", occurredAt,
          properties: { method: "google" }
        },
        {
          type: "event", eventUuid: eventUuids[4], viewUuid, schemaVersion: 1,
          name: "professional_signup_request_error", occurredAt,
          properties: { method: "google", reason: "network_error" }
        }
      ]
    };

    try {
      const first = await coletar({ usuarioId: null, body: payload });
      const retry = await coletar({ usuarioId: null, body: payload });
      expect(first.recebido).toBe(true);
      expect(first.gravados).toBe(6);
      expect(retry.gravados).toBe(0);

      const result = await db.query(
        "SELECT v.page_key, e.nome, e.propriedades, e.visualizacao_id " +
        "FROM analytics_eventos e " +
        "JOIN analytics_visualizacoes_tela v ON v.id = e.visualizacao_id " +
        "JOIN analytics_sessoes s ON s.id = e.sessao_id " +
        "WHERE s.session_uuid = $1::UUID ORDER BY e.nome",
        [sessionUuid]
      );
      expect(result.rows).toHaveLength(5);
      expect(result.rows.every(row => row.page_key === "professional_register" && row.visualizacao_id)).toBe(true);
      expect(result.rows.find(row => row.nome === "professional_signup_validation_error").propriedades)
        .toEqual({ field: "email", reason: "invalid_format" });
      expect(JSON.stringify(result.rows)).not.toContain("não persistir");

      const after = await buscarJornada("today");
      const count = key => Number(after.cadastroProfissional[key]) - Number(before.cadastroProfissional[key]);
      expect(count("sessoes_visita")).toBe(1);
      expect(count("sessoes_inicio")).toBe(1);
      expect(count("sessoes_envio")).toBe(1);
      expect(count("sessoes_envio_email")).toBe(1);
      expect(count("sessoes_envio_google")).toBe(1);
      expect(count("sessoes_erro")).toBe(1);
      expect(count("sessoes_erro_requisicao")).toBe(1);
      expect(after.cadastroProfissional).not.toHaveProperty("contas_criadas");
    } finally {
      await cleanup();
    }
  });
});
