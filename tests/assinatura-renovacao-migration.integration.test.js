const fs = require("node:fs");
const path = require("node:path");
const db = require("../src/db/db");
jest.setTimeout(30000);

test("migration 118 preserva períodos e recupera tentativas legadas mesmo suspensas", async () => {
  const client = await db.connect();
  const schema = `owner_renewal_migration_${process.pid}_${Date.now()}`;
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`CREATE TABLE assinaturas (
      id INTEGER PRIMARY KEY, negocio_id INTEGER, status TEXT, ativo BOOLEAN, data_proxima_cobranca DATE,
      reativacao_tentativa INTEGER, reativacao_inicio_cobranca DATE, updated_at TIMESTAMPTZ,
      asaas_subscription_id TEXT DEFAULT 'sub_legacy'
    )`);
    await client.query(`CREATE TABLE pagamentos (
      assinatura_id INTEGER, status TEXT, data_pagamento DATE, data_vencimento DATE
    )`);
    await client.query(`INSERT INTO assinaturas VALUES
      (1,7,'ACTIVE',TRUE,'2099-12-01',0,NULL,NOW()),
      (2,7,'REACTIVATING',TRUE,'2099-12-01',1,'2099-12-01',NOW()-INTERVAL '3 minutes'),
      (3,7,'REACTIVATING',FALSE,'2000-02-01',2,'2000-02-01',NOW()-INTERVAL '3 minutes'),
      (4,7,'REACTIVATING',TRUE,NULL,1,NULL,NOW()),
      (5,7,'CANCELED',FALSE,'2000-02-01',1,NULL,NOW()),
      (6,7,'PENDING',FALSE,'2099-12-01',0,NULL,NOW())`);
    const migration = fs.readFileSync(path.join(__dirname, "../database/migrations/118_assinatura_acesso_e_operacao_renovacao.sql"), "utf8");
    await client.query(migration);
    const periods = (await client.query(`SELECT id,TO_CHAR(acesso_pago_ate,'YYYY-MM-DD') AS paid FROM assinaturas ORDER BY id`)).rows;
    expect(periods).toEqual([
      { id: 1, paid: "2099-12-01" }, { id: 2, paid: "2099-12-01" }, { id: 3, paid: "2000-02-01" },
      { id: 4, paid: null }, { id: 5, paid: "2000-02-01" }, { id: 6, paid: null },
    ]);
    const pending = (await client.query(`SELECT assinatura_id,tentativa,referencia_externa,estado,lease_ate <= NOW() AS abandoned
      FROM assinatura_renovacao_operacoes ORDER BY assinatura_id`)).rows;
    expect(pending).toEqual([
      { assinatura_id: 2, tentativa: 1, referencia_externa: "assinatura-reativada:2;tentativa:1;inicio:2099-12-01", estado: "PENDING", abandoned: true },
      { assinatura_id: 3, tentativa: 2, referencia_externa: "assinatura-reativada:3;tentativa:2;inicio:2000-02-01", estado: "PENDING", abandoned: true },
    ]);
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    client.release();
  }
});
afterAll(async () => { await db.end(); });
