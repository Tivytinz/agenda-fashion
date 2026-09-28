const fs = require(
  "fs"
);
const path = require(
  "path"
);
const crypto = require(
  "crypto"
);
const db = require(
  "../src/db/db"
);

function migration(
  name
) {
  return fs.readFileSync(
    path.join(
      __dirname,
      "../database/migrations",
      name
    ),
    "utf8"
  );
}

describe(
  "migration do default de cancelamento da agenda",
  () => {
    afterAll(
      () => db.end()
    );

    test(
      "normaliza somente padrao_af e cria novos vínculos com 2 horas",
      async () => {
        const client =
          await db.connect();
        const schema =
          `af_cancelamento_padrao_${crypto
            .randomBytes(8)
            .toString("hex")}`;

        try {
          await client.query(
            `CREATE SCHEMA "${schema}"`
          );
          await client.query(
            `SET search_path TO "${schema}"`
          );

          await client.query(`
            CREATE TABLE agenda_configuracoes (
              profissional_id INT NOT NULL,
              negocio_id INT NOT NULL,
              duracao_padrao INT NOT NULL DEFAULT 60,
              intervalo_minutos INT NOT NULL DEFAULT 0,
              antecedencia_agendamento INT NOT NULL DEFAULT 0,
              antecedencia_cancelamento INT NOT NULL DEFAULT 0,
              configurado_em TIMESTAMPTZ,
              origem_horarios TEXT NOT NULL,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE (profissional_id, negocio_id)
            );

            CREATE TABLE agenda_horarios (
              profissional_id INT NOT NULL,
              negocio_id INT NOT NULL,
              dia_semana SMALLINT NOT NULL,
              trabalha BOOLEAN NOT NULL,
              hora_inicio TIME,
              hora_fim TIME,
              intervalo_inicio TIME,
              intervalo_fim TIME,
              UNIQUE (
                profissional_id,
                negocio_id,
                dia_semana
              )
            );

            CREATE TABLE usuarios_negocios (
              id BIGSERIAL PRIMARY KEY,
              usuario_id INT NOT NULL,
              negocio_id INT NOT NULL,
              papel TEXT NOT NULL,
              ativo BOOLEAN NOT NULL DEFAULT TRUE
            );

            INSERT INTO agenda_configuracoes (
              profissional_id,
              negocio_id,
              antecedencia_cancelamento,
              origem_horarios
            )
            VALUES
              (1, 11, 24, 'padrao_af'),
              (2, 12, 0, 'padrao_af'),
              (3, 13, 24, 'personalizado'),
              (4, 14, 24, 'legado_desconhecido');
          `);

          await client.query(
            migration(
              "110_antecedencia_cancelamento_padrao_af.sql"
            )
          );

          const configs =
            await client.query(`
              SELECT
                profissional_id,
                antecedencia_cancelamento,
                origem_horarios
              FROM agenda_configuracoes
              ORDER BY profissional_id
            `);

          expect(
            configs.rows
          ).toEqual([
            {
              profissional_id:
                1,
              antecedencia_cancelamento:
                2,
              origem_horarios:
                "padrao_af",
            },
            {
              profissional_id:
                2,
              antecedencia_cancelamento:
                2,
              origem_horarios:
                "padrao_af",
            },
            {
              profissional_id:
                3,
              antecedencia_cancelamento:
                24,
              origem_horarios:
                "personalizado",
            },
            {
              profissional_id:
                4,
              antecedencia_cancelamento:
                24,
              origem_horarios:
                "legado_desconhecido",
            },
          ]);

          await client.query(`
            CREATE TRIGGER
              usuarios_negocios_agenda_contextual_trigger
            AFTER INSERT OR UPDATE OF
              usuario_id,
              negocio_id,
              papel,
              ativo
            ON usuarios_negocios
            FOR EACH ROW
            EXECUTE FUNCTION
              garantir_agenda_contextual_vinculo();
          `);

          await client.query(`
            INSERT INTO usuarios_negocios (
              usuario_id,
              negocio_id,
              papel,
              ativo
            )
            VALUES (
              5,
              15,
              'dono',
              TRUE
            );
          `);

          const novo =
            await client.query(`
              SELECT
                antecedencia_cancelamento,
                origem_horarios
              FROM agenda_configuracoes
              WHERE profissional_id = 5
                AND negocio_id = 15
            `);

          expect(
            novo.rows[0]
          ).toEqual({
            antecedencia_cancelamento:
              2,
            origem_horarios:
              "padrao_af",
          });

          const horarios =
            await client.query(`
              SELECT COUNT(*)::INT
                AS total
              FROM agenda_horarios
              WHERE profissional_id = 5
                AND negocio_id = 15
            `);

          expect(
            horarios.rows[0].total
          ).toBe(7);
        } finally {
          await client.query(
            "ROLLBACK"
          ).catch(
            () => {}
          );
          await client.query(
            "SET search_path TO public"
          );
          await client.query(
            `DROP SCHEMA IF EXISTS "${schema}" CASCADE`
          );
          client.release();
        }
      }
    );
  }
);
