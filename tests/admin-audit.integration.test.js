const crypto = require("crypto");
const db = require("../src/db/db");
const repository = require("../src/repositories/adminAuditRepository");

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
    await expect(client.query("TRUNCATE admin_auditoria_eventos"))
      .rejects.toThrow(/append-only/);
    await client.query("ROLLBACK TO SAVEPOINT audit_immutable");
  });
});
