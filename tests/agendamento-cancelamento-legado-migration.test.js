const fs = require("fs");
const path = require("path");

const db = require("../src/db/db");

function lerMigration(nome) {
  return fs.readFileSync(
    path.join(
      __dirname,
      "../database/migrations",
      nome
    ),
    "utf8"
  );
}

function nomeSchema() {
  return (
    "af_ag24_" +
    Date.now() +
    "_" +
    Math.floor(Math.random() * 100000)
  );
}

describe("CA-AG-24: reconciliação do cancelamento solicitado legado", () => {
  afterAll(async () => {
    await db.end();
  });

  test("migra futuro, conclui com evidência e envia passado ambíguo para revisão", async () => {
    const client = await db.connect();
    const schema = nomeSchema();

    try {
      await client.query(
        `CREATE SCHEMA "${schema}"`
      );
      await client.query(
        `SET search_path TO "${schema}", public`
      );

      await client.query(`
        CREATE TABLE usuarios (
          id BIGINT PRIMARY KEY
        );

        CREATE TABLE negocios (
          id BIGINT PRIMARY KEY,
          fuso_horario TEXT
        );

        CREATE TABLE agendamentos (
          id BIGINT PRIMARY KEY,
          negocio_id BIGINT NOT NULL,
          data DATE NOT NULL,
          horario TIME NOT NULL,
          status VARCHAR(40) NOT NULL,
          avaliacao INTEGER,
          atendimento_iniciado_em TIMESTAMPTZ,
          status_atendimento_em TIMESTAMPTZ,
          status_atendimento_por BIGINT,
          cancelado_em TIMESTAMPTZ,
          motivo_cancelamento VARCHAR(300)
        );
      `);

      await client.query(`
        INSERT INTO usuarios (id)
        VALUES (1);

        INSERT INTO negocios (
          id,
          fuso_horario
        )
        VALUES (
          10,
          'America/Sao_Paulo'
        );

        INSERT INTO agendamentos (
          id,
          negocio_id,
          data,
          horario,
          status,
          avaliacao
        )
        VALUES
          (
            1,
            10,
            CURRENT_DATE + 2,
            '15:00',
            'CANCELAMENTO_SOLICITADO',
            NULL
          ),
          (
            2,
            10,
            CURRENT_DATE - 2,
            '15:00',
            'cancelamento_solicitado',
            5
          ),
          (
            3,
            10,
            CURRENT_DATE - 2,
            '15:00',
            'cancelamento_solicitado',
            NULL
          );
      `);

      await client.query(
        lerMigration(
          "089_cancelamento_solicitado_legado.sql"
        )
      );

      const estados = await client.query(`
        SELECT id, status
        FROM agendamentos
        ORDER BY id
      `);

      expect(estados.rows).toEqual([
        { id: "1", status: "cancelado" },
        { id: "2", status: "realizado" },
        {
          id: "3",
          status: "cancelamento_solicitado",
        },
      ]);

      const auditoria = await client.query(`
        SELECT
          agendamento_id,
          decisao,
          resolvido_em IS NOT NULL
            AS resolvido
        FROM
          agendamento_cancelamento_legado_revisoes
        ORDER BY agendamento_id
      `);

      expect(auditoria.rows).toEqual([
        {
          agendamento_id: "1",
          decisao: "cancelado",
          resolvido: true,
        },
        {
          agendamento_id: "2",
          decisao: "realizado",
          resolvido: true,
        },
        {
          agendamento_id: "3",
          decisao: "revisao",
          resolvido: false,
        },
      ]);

      const resolucao = await client.query(
        `
          SELECT
            resolver_cancelamento_solicitado_legado(
              3,
              'falta',
              '{"fonte":"revisao_operacional","confirmado":true}'::JSONB,
              1
            ) AS resultado
        `
      );

      expect(
        resolucao.rows[0]?.resultado
      ).toBe("falta");

      const falta = await client.query(`
        SELECT
          a.status,
          r.decisao,
          r.resolvido_por,
          r.resolvido_em IS NOT NULL
            AS resolvido,
          r.evidencia ->> 'fonte'
            AS fonte
        FROM agendamentos a
        INNER JOIN
          agendamento_cancelamento_legado_revisoes r
          ON r.agendamento_id = a.id
        WHERE a.id = 3
      `);

      expect(falta.rows[0]).toMatchObject({
        status: "falta",
        decisao: "falta",
        resolvido_por: "1",
        resolvido: true,
        fonte: "revisao_operacional",
      });

      await expect(
        client.query(`
          INSERT INTO agendamentos (
            id,
            negocio_id,
            data,
            horario,
            status
          )
          VALUES (
            4,
            10,
            CURRENT_DATE + 5,
            '10:00',
            'cancelamento_solicitado'
          )
        `)
      ).rejects.toMatchObject({
        code: "23514",
      });
    } finally {
      try {
        await client.query(
          "SET search_path TO public"
        );
        await client.query(
          `DROP SCHEMA IF EXISTS "${schema}" CASCADE`
        );
      } finally {
        client.release();
      }
    }
  });
});
