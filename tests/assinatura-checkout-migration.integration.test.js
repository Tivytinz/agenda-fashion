const fs = require("node:fs");
const path = require("node:path");
const db = require("../src/db/db");
jest.setTimeout(30000);

test("migration 120 recupera identidades conhecidas sem alterar acesso ou depender de status CANCELED", async () => {
  const client = await db.connect();
  const schema = `owner_checkout_migration_${process.pid}_${Date.now()}`;
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`CREATE TABLE assinaturas(id INTEGER PRIMARY KEY, negocio_id INTEGER, plano_id INTEGER,
      asaas_subscription_id TEXT, asaas_customer_id TEXT, forma_pagamento TEXT, observacoes TEXT, status TEXT, ativo BOOLEAN)`);
    await client.query(`CREATE TABLE pagamentos(id INTEGER PRIMARY KEY, assinatura_id INTEGER, data_pagamento DATE)`);
    await client.query(`CREATE TABLE assinatura_renovacao_operacoes(id INTEGER PRIMARY KEY)`);
    await client.query(`INSERT INTO assinaturas VALUES
      (1,7,2,NULL,'cus_a','pix',NULL,'REFUNDED',FALSE),
      (2,7,2,'sub_old','cus_a','pix','Recorrência substituída por uma nova assinatura.','REFUNDED',FALSE),
      (3,7,2,'sub_current','cus_a','pix',NULL,'ACTIVE',TRUE),
      (4,7,2,NULL,'cus_a','pix',NULL,'PENDING',FALSE),
      (5,8,2,NULL,NULL,'pix',NULL,'REFUNDED',FALSE)`);
    await client.query(`INSERT INTO pagamentos VALUES (1,1,'2026-10-01'),(2,4,NULL),(3,5,'2026-10-01')`);
    await client.query(fs.readFileSync(path.join(__dirname,"../database/migrations/120_assinatura_checkout_operacoes.sql"),"utf8"));
    expect((await client.query(`SELECT assinatura_id,tipo,referencia_externa,estado,asaas_subscription_id
      FROM assinatura_checkout_operacoes ORDER BY assinatura_id`)).rows).toEqual([
      {assinatura_id:1,tipo:"CREATE",referencia_externa:"assinatura:1;negocio:7;plano:2",estado:"PENDING",asaas_subscription_id:null},
      {assinatura_id:2,tipo:"REMOVE",referencia_externa:"remover:sub_old",estado:"REMOVING",asaas_subscription_id:"sub_old"},
    ]);
    expect((await client.query("SELECT id,status,ativo FROM assinaturas ORDER BY id")).rows).toEqual([
      {id:1,status:"REFUNDED",ativo:false},{id:2,status:"REFUNDED",ativo:false},{id:3,status:"ACTIVE",ativo:true},
      {id:4,status:"PENDING",ativo:false},{id:5,status:"REFUNDED",ativo:false},
    ]);
    await client.query("DELETE FROM assinaturas WHERE id=1");
    expect((await client.query("SELECT COUNT(*)::int AS total FROM assinatura_checkout_operacoes WHERE assinatura_id=1")).rows[0].total).toBe(0);
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    client.release();
  }
});
afterAll(async()=>{await db.end();});
