const crypto = require("crypto");
const db = require("../src/db/db");
const repository = require("../src/repositories/adminAuditRepository");
const service = require("../src/services/adminAuditService");

describe("admin audit ledger in PostgreSQL", () => {
  let client;

  beforeAll(async () => {
    client = await db.connect();
    await client.query("BEGIN");
  });
  afterAll(async () => {
    if (client) {
      await client.query("ROLLBACK");
      client.release();
    }
    await db.end();
  });

  test("registra tentativa e resultado uma vez; proíbe UPDATE/DELETE", async () => {
    const tentativaId = crypto.randomUUID();
    const item = {
      tentativaId, fase: "INICIADA", atorUsuarioId: 77202,
      papelAdmin: "superadmin", acao: "campanha_criar",
      alvoTipo: "campanha", requestId: "test-request-77202"
    };
    await repository.registrarEvento(item, client);
    await repository.registrarEvento({
      ...item, fase: "RESULTADO", alvoId: 42,
      resultado: "HTTP_OK", httpStatus: 201
    }, client);
    const pendingId = crypto.randomUUID();
    await repository.registrarEvento({ ...item, tentativaId: pendingId }, client);
    const listed = await repository.listar({
      atorId: 77202, acao: "campanha_criar", alvoTipo: "campanha",
      alvoId: 42, limite: 25, offset: 0
    }, client);
    expect(listed.total).toBe(1);
    expect(listed.rows[0]).toMatchObject({
      alvo_id: "42", resultado: "HTTP_OK", http_status: 201
    });
    const pending = await repository.listar({
      atorId: 77202, resultado: "PENDENTE", limite: 25, offset: 0
    }, client);
    expect(pending.total).toBe(1);
    expect(pending.rows[0].tentativa_id).toBe(pendingId);
    expect(pending.rows[0].resultado).toBeNull();
    const completed = await repository.listar({
      atorId: 77202, resultado: "HTTP_OK", limite: 25, offset: 0
    }, client);
    expect(completed.total).toBe(1);

    await client.query("SAVEPOINT audit_immutable");
    await expect(client.query(
      "UPDATE admin_auditoria_eventos SET acao = 'alterada' WHERE tentativa_id = $1",
      [tentativaId]
    )).rejects.toThrow(/append-only/);
    await client.query("ROLLBACK TO SAVEPOINT audit_immutable");
    await expect(client.query(
      "DELETE FROM admin_auditoria_eventos WHERE tentativa_id = $1", [tentativaId]
    )).rejects.toThrow(/append-only/);
    await client.query("ROLLBACK TO SAVEPOINT audit_immutable");
    await expect(client.query("TRUNCATE admin_auditoria_eventos, admin_auditoria_revisoes"))
      .rejects.toThrow(/append-only/);
    await client.query("ROLLBACK TO SAVEPOINT audit_immutable");
  });

  test("revisa pendência antiga uma vez e preserva resultado HTTP tardio", async () => {
    const tentativaId = crypto.randomUUID();
    const { rows } = await client.query(`
      INSERT INTO admin_auditoria_eventos (
        tentativa_id, fase, ator_usuario_id, papel_admin, acao,
        alvo_tipo, ocorrido_em
      ) VALUES ($1, 'INICIADA', 77203, 'admin', 'campanha_criar',
        'campanha', NOW() - INTERVAL '15 minutes')
      RETURNING id
    `, [tentativaId]);
    const pending = await repository.buscarTentativaParaRevisao(tentativaId, client);
    expect(pending).toMatchObject({ id: rows[0].id, vencida: true });
    const review = {
      tentativaId, revisorUsuarioId: 77204,
      avaliacao: "INDETERMINADO", evidenciaTipo: "LOG_APLICACAO",
      evidenciaReferenciaHash: crypto.createHash("sha256").update("request-77203").digest("hex")
    };
    await repository.registrarRevisao(review, client);
    const reviewed = await repository.listar({
      atorId: 77203, resultado: "REVISADA", limite: 25, offset: 0
    }, client);
    expect(reviewed.total).toBe(1);
    expect(reviewed.rows[0]).toMatchObject({
      tentativa_id: tentativaId, avaliacao: "INDETERMINADO",
      revisor_usuario_id: "77204"
    });
    const noPending = await repository.listar({
      atorId: 77203, resultado: "PENDENTE", limite: 25, offset: 0
    }, client);
    expect(noPending.total).toBe(0);

    await client.query("SAVEPOINT review_immutable");
    await expect(repository.registrarRevisao(review, client))
      .rejects.toMatchObject({ code: "23505" });
    await client.query("ROLLBACK TO SAVEPOINT review_immutable");
    await expect(client.query(
      "UPDATE admin_auditoria_revisoes SET avaliacao = 'EFEITO_OBSERVADO' WHERE tentativa_id = $1",
      [tentativaId]
    )).rejects.toThrow(/append-only/);
    await client.query("ROLLBACK TO SAVEPOINT review_immutable");
    await expect(client.query(
      "DELETE FROM admin_auditoria_revisoes WHERE tentativa_id = $1", [tentativaId]
    )).rejects.toThrow(/append-only/);
    await client.query("ROLLBACK TO SAVEPOINT review_immutable");
    await expect(client.query("TRUNCATE admin_auditoria_revisoes"))
      .rejects.toThrow(/append-only/);
    await client.query("ROLLBACK TO SAVEPOINT review_immutable");

    await repository.registrarEvento({
      tentativaId, fase: "RESULTADO", atorUsuarioId: 77203,
      papelAdmin: "admin", acao: "campanha_criar", alvoTipo: "campanha",
      resultado: "HTTP_OK", httpStatus: 201
    }, client);
    const late = await repository.listar({
      atorId: 77203, resultado: "HTTP_OK", limite: 25, offset: 0
    }, client);
    expect(late.total).toBe(1);
    expect(late.rows[0].revisao_id).toBeTruthy();
  });

  test("duas revisões concorrentes não duplicam uma tentativa", async () => {
    // Intentionally committed in the ephemeral CI database: append-only rows
    // cannot be deleted for cleanup after two independent transactions.
    const tentativaId = crypto.randomUUID();
    await db.query(`
      INSERT INTO admin_auditoria_eventos (
        tentativa_id, fase, ator_usuario_id, papel_admin, acao,
        alvo_tipo, ocorrido_em
      ) VALUES ($1, 'INICIADA', 77205, 'admin', 'campanha_criar',
        'campanha', NOW() - INTERVAL '15 minutes')
    `, [tentativaId]);
    const review = () => service.review({
      admin: { usuarioId: 77206, papel: "superadmin" },
      tentativaId, avaliacao: "INDETERMINADO",
      evidenciaTipo: "LOG_APLICACAO", evidenciaReferencia: "request-77205"
    });
    const outcomes = await Promise.allSettled([review(), review()]);
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((item) => item.status === "rejected"))
      .toEqual([expect.objectContaining({ reason: expect.objectContaining({ statusCode: 409 }) })]);
    const count = await db.query(
      "SELECT COUNT(*)::INT AS total FROM admin_auditoria_revisoes WHERE tentativa_id = $1",
      [tentativaId]
    );
    expect(count.rows[0].total).toBe(1);
  });
});
