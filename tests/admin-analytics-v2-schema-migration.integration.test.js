const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../src/db/db");

const migration = fs.readFileSync(
  path.join(
    __dirname,
    "../database/migrations/066_reconciliar_schema_admin_analytics_v2.sql"
  ),
  "utf8"
);

async function criarSchemaLegado(client, schema, { comPagamentoOrfao = false } = {}) {
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  await client.query(`
    CREATE TABLE negocios (
      id INTEGER PRIMARY KEY,
      publicado BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE assinaturas (
      id INTEGER PRIMARY KEY
    );

    CREATE TABLE pagamentos (
      id SERIAL PRIMARY KEY,
      asaas_payment_id VARCHAR(120),
      valor NUMERIC(10, 2) NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      data_pagamento DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(
    `INSERT INTO negocios (id, publicado, updated_at)
     VALUES
       (1, TRUE, '2026-08-15T12:00:00Z'),
       (2, FALSE, '2026-08-16T12:00:00Z')`
  );
  await client.query("INSERT INTO assinaturas (id) VALUES (10)");

  if (comPagamentoOrfao) {
    await client.query(
      `INSERT INTO pagamentos (asaas_payment_id, valor, status, data_pagamento)
       VALUES ('pay_legado', 49.90, 'CONFIRMED', '2026-08-20')`
    );
  }
}

async function destruirSchema(client, schema) {
  await client.query("SET search_path TO public");
  await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
}

describe("migration 066 - reconciliação do schema do Admin Analytics V2", () => {
  afterAll(() => db.end());

  test("repara banco legado sem inventar vínculo para pagamento órfão", async () => {
    const client = await db.connect();
    const schema = `af_admin_v2_drift_${crypto.randomBytes(8).toString("hex")}`;

    try {
      await criarSchemaLegado(client, schema, { comPagamentoOrfao: true });
      await client.query(migration);

      const negocio = await client.query(
        `SELECT primeira_publicacao_em
         FROM negocios
         WHERE id = 1`
      );
      expect(negocio.rows[0].primeira_publicacao_em.toISOString()).toBe(
        "2026-08-15T12:00:00.000Z"
      );

      const aindaNaoPublicado = await client.query(
        `SELECT primeira_publicacao_em
         FROM negocios
         WHERE id = 2`
      );
      expect(aindaNaoPublicado.rows[0].primeira_publicacao_em).toBeNull();

      await client.query("UPDATE negocios SET publicado = TRUE WHERE id = 2");
      const publicadoDepois = await client.query(
        `SELECT primeira_publicacao_em
         FROM negocios
         WHERE id = 2`
      );
      expect(publicadoDepois.rows[0].primeira_publicacao_em).toBeInstanceOf(Date);

      const colunaPagamento = await client.query(
        `SELECT is_nullable
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'pagamentos'
           AND column_name = 'assinatura_id'`
      );
      expect(colunaPagamento.rows).toEqual([{ is_nullable: "YES" }]);

      const legado = await client.query(
        "SELECT assinatura_id FROM pagamentos WHERE asaas_payment_id = 'pay_legado'"
      );
      expect(legado.rows[0].assinatura_id).toBeNull();

      const fk = await client.query(
        `SELECT COUNT(*)::INT AS total
         FROM information_schema.table_constraints tc
         INNER JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_catalog = tc.constraint_catalog
          AND kcu.constraint_schema = tc.constraint_schema
          AND kcu.constraint_name = tc.constraint_name
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = current_schema()
           AND tc.table_name = 'pagamentos'
           AND kcu.column_name = 'assinatura_id'`
      );
      expect(fk.rows[0].total).toBe(1);

      const indice = await client.query(
        `SELECT COUNT(*)::INT AS total
         FROM pg_indexes
         WHERE schemaname = current_schema()
           AND tablename = 'pagamentos'
           AND indexname = 'idx_pagamentos_assinatura'`
      );
      expect(indice.rows[0].total).toBe(1);

      await expect(
        client.query(
          `INSERT INTO pagamentos (asaas_payment_id, valor, assinatura_id)
           VALUES ('pay_sem_assinatura', 49.90, NULL)`
        )
      ).rejects.toMatchObject({ code: "23514" });

      await client.query(
        `INSERT INTO pagamentos (asaas_payment_id, valor, assinatura_id)
         VALUES ('pay_valido', 49.90, 10)`
      );

      await expect(
        client.query(
          `INSERT INTO pagamentos (asaas_payment_id, valor, assinatura_id)
           VALUES ('pay_fk_invalida', 49.90, 999)`
        )
      ).rejects.toMatchObject({ code: "23503" });

      // A reconciliação precisa poder ser reaplicada sem duplicar objetos.
      await client.query(migration);
    } finally {
      await destruirSchema(client, schema);
      client.release();
    }
  });

  test("restaura NOT NULL quando não existem pagamentos legados órfãos", async () => {
    const client = await db.connect();
    const schema = `af_admin_v2_clean_${crypto.randomBytes(8).toString("hex")}`;

    try {
      await criarSchemaLegado(client, schema);
      await client.query(migration);

      const coluna = await client.query(
        `SELECT is_nullable
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'pagamentos'
           AND column_name = 'assinatura_id'`
      );
      expect(coluna.rows).toEqual([{ is_nullable: "NO" }]);

      await expect(
        client.query(
          `INSERT INTO pagamentos (asaas_payment_id, valor, assinatura_id)
           VALUES ('pay_sem_assinatura', 49.90, NULL)`
        )
      ).rejects.toMatchObject({ code: "23502" });

      await client.query(
        `INSERT INTO pagamentos (asaas_payment_id, valor, assinatura_id)
         VALUES ('pay_valido', 49.90, 10)`
      );
    } finally {
      await destruirSchema(client, schema);
      client.release();
    }
  });
});
