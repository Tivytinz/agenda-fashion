const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../src/db/db");
const {
  buscarReceita,
  buscarVisaoGeral,
} = require("../src/repositories/adminAnalyticsV2Repository");

const migration = fs.readFileSync(
  path.join(
    __dirname,
    "../database/migrations/066_reconciliar_schema_admin_analytics_v2.sql"
  ),
  "utf8"
);

async function criarSchemaMinimoLegado(client, schema) {
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  await client.query(`
    CREATE TABLE analytics_sessoes (
      id BIGSERIAL PRIMARY KEY,
      usuario_id BIGINT,
      visitante_id VARCHAR(80),
      visualizacoes INTEGER NOT NULL DEFAULT 0,
      tempo_engajado_ms BIGINT NOT NULL DEFAULT 0,
      iniciada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE marketing_usuario_atribuicoes (
      usuario_id BIGINT PRIMARY KEY,
      intencao VARCHAR(24) NOT NULL,
      atribuicao_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE negocios (
      id SERIAL PRIMARY KEY,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      publicado BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE agendamentos (
      id SERIAL PRIMARY KEY,
      negocio_id INTEGER NOT NULL REFERENCES negocios(id),
      status VARCHAR(30),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE planos (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(80) NOT NULL,
      slug VARCHAR(80) NOT NULL,
      valor NUMERIC(10, 2) NOT NULL DEFAULT 0
    );

    CREATE TABLE assinaturas (
      id SERIAL PRIMARY KEY,
      negocio_id INTEGER NOT NULL REFERENCES negocios(id),
      plano_id INTEGER NOT NULL REFERENCES planos(id),
      valor NUMERIC(10, 2) NOT NULL DEFAULT 0,
      ativo BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE pagamentos (
      id SERIAL PRIMARY KEY,
      asaas_payment_id VARCHAR(120),
      valor NUMERIC(10, 2) NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      data_pagamento DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE checkout_tentativas (
      id SERIAL PRIMARY KEY,
      negocio_id INTEGER REFERENCES negocios(id),
      assinatura_id INTEGER REFERENCES assinaturas(id),
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function destruirSchema(client, schema) {
  await client.query("SET search_path TO public");
  await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
}

describe("Admin Analytics V2 repository - schema reconciliado", () => {
  afterAll(() => db.end());

  test("Visão geral e Receita executam as queries reais após reparar o schema legado", async () => {
    const client = await db.connect();
    const schema = `af_admin_v2_repository_${crypto.randomBytes(8).toString("hex")}`;
    let querySpy;

    try {
      await criarSchemaMinimoLegado(client, schema);
      await client.query(migration);

      querySpy = jest
        .spyOn(db, "query")
        .mockImplementation((texto, parametros) => client.query(texto, parametros));

      await expect(buscarVisaoGeral("today")).resolves.toEqual(
        expect.objectContaining({
          periodo: "today",
          sessoes: expect.anything(),
          usuarios_ativos: expect.anything(),
          negocios_publicados: expect.anything(),
          pagamentos_confirmados: expect.anything(),
        })
      );

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
    } finally {
      querySpy?.mockRestore();
      await destruirSchema(client, schema);
      client.release();
    }
  });
});
