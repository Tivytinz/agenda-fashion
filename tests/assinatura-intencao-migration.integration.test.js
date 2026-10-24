const fs = require("node:fs");
const path = require("node:path");
const db = require("../src/db/db");
jest.setTimeout(30000);

test("migration 119 recupera apenas cancelamentos identificáveis do ciclo atual, sem conceder acesso", async () => {
  const client = await db.connect();
  const schema = `owner_intent_migration_${process.pid}_${Date.now()}`;
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`CREATE TABLE assinaturas (
      id INTEGER PRIMARY KEY, status TEXT, ativo BOOLEAN, asaas_subscription_id TEXT,
      reativacao_tentativa INTEGER DEFAULT 0, renovacao_chave_versao INTEGER DEFAULT 1,
      acesso_pago_ate DATE
    )`);
    await client.query(`CREATE TABLE assinatura_eventos (assinatura_id INTEGER, tipo TEXT, detalhes JSONB)`);
    await client.query(`CREATE TABLE assinatura_renovacao_operacoes (assinatura_id INTEGER, estado TEXT)`);
    await client.query(`INSERT INTO assinaturas VALUES
      (1,'CANCELED',TRUE,'sub_1',0,1,'2099-12-01'),
      (2,'REFUNDED',FALSE,'sub_current',2,1,'2099-12-01'),
      (3,'ACTIVE',TRUE,'sub_new',2,1,'2099-12-01'),
      (4,'DELETED',FALSE,NULL,0,1,NULL),
      (5,'INACTIVE',FALSE,'sub_5',0,1,'2099-12-01'),
      (6,'REACTIVATING',FALSE,NULL,1,1,'2000-01-01'),
      (7,'ACTIVE',TRUE,'sub_legacy',0,0,'2099-12-01'),
      (8,'PENDING',FALSE,NULL,0,1,NULL)`);
    await client.query(`INSERT INTO assinatura_eventos VALUES
      (2,'RENOVACAO_CANCELADA','{"asaas_subscription_id":"sub_current","reativacao_tentativa":2}'),
      (3,'RENOVACAO_CANCELADA','{"asaas_subscription_id":"sub_old","reativacao_tentativa":1}'),
      (7,'RENOVACAO_CANCELADA','{"acesso_ate":"2099-12-01"}')`);
    await client.query(fs.readFileSync(path.join(__dirname,
      "../database/migrations/119_assinatura_intencao_e_reconciliacao_financeira.sql"), "utf8"));
    const rows = (await client.query(`SELECT id,status,ativo,renovacao_cancelada,acesso_pago_reconciliado,
      TO_CHAR(acesso_pago_ate,'YYYY-MM-DD') AS paid FROM assinaturas ORDER BY id`)).rows;
    expect(rows.map(row => [row.id,row.renovacao_cancelada,row.acesso_pago_reconciliado])).toEqual([
      [1,true,false],[2,true,true],[3,false,false],[4,false,false],
      [5,true,false],[6,true,false],[7,true,false],[8,false,true],
    ]);
    expect(rows.find(row => row.id === 3)).toMatchObject({status:"ACTIVE",ativo:true});
    expect(rows.find(row => row.id === 7)).toMatchObject({status:"CANCELED",ativo:true});
    expect(rows.find(row => row.id === 5)).toMatchObject({status:"INACTIVE",ativo:false,paid:"2099-12-01"});
    expect((await client.query("SELECT * FROM assinatura_renovacao_operacoes")).rows).toHaveLength(0);
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    client.release();
  }
});

afterAll(async () => { await db.end(); });
