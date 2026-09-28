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
  "política de cancelamento por negócio",
  () => {
    afterAll(
      () => db.end()
    );

    test(
      "migra a política da dona, ignora valor da profissional e preserva snapshots antigos",
      async () => {
        const client =
          await db.connect();
        const schema =
          `af_cancelamento_negocio_${crypto
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
            CREATE TABLE negocios (
              id BIGINT PRIMARY KEY,
              ativo BOOLEAN NOT NULL DEFAULT TRUE,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE usuarios_negocios (
              id BIGSERIAL PRIMARY KEY,
              usuario_id BIGINT NOT NULL,
              negocio_id BIGINT NOT NULL,
              papel TEXT NOT NULL,
              ativo BOOLEAN NOT NULL DEFAULT TRUE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE agenda_configuracoes (
              profissional_id BIGINT NOT NULL,
              negocio_id BIGINT NOT NULL,
              duracao_padrao INT NOT NULL DEFAULT 60,
              intervalo_minutos INT NOT NULL DEFAULT 0,
              antecedencia_agendamento INT NOT NULL DEFAULT 0,
              antecedencia_cancelamento INT NOT NULL DEFAULT 2,
              configurado_em TIMESTAMPTZ,
              origem_horarios TEXT NOT NULL DEFAULT 'padrao_af',
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE (profissional_id, negocio_id)
            );

            CREATE TABLE agenda_horarios (
              profissional_id BIGINT NOT NULL,
              negocio_id BIGINT NOT NULL,
              dia_semana SMALLINT NOT NULL,
              trabalha BOOLEAN NOT NULL,
              hora_inicio TIME,
              hora_fim TIME,
              intervalo_inicio TIME,
              intervalo_fim TIME,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE (
                profissional_id,
                negocio_id,
                dia_semana
              )
            );

            CREATE TABLE servicos_negocio (
              id BIGINT PRIMARY KEY,
              nome TEXT NOT NULL
            );

            CREATE TABLE agendamentos (
              id BIGSERIAL PRIMARY KEY,
              negocio_id BIGINT NOT NULL,
              profissional_id BIGINT NOT NULL,
              servico_id BIGINT NOT NULL,
              servico_nome TEXT,
              antecedencia_cancelamento_horas INT
            );

            INSERT INTO negocios (
              id
            )
            VALUES
              (11),
              (12);

            INSERT INTO usuarios_negocios (
              usuario_id,
              negocio_id,
              papel,
              ativo
            )
            VALUES
              (1, 11, 'dono', TRUE),
              (2, 11, 'profissional', TRUE);

            INSERT INTO agenda_configuracoes (
              profissional_id,
              negocio_id,
              antecedencia_cancelamento,
              origem_horarios
            )
            VALUES
              (1, 11, 12, 'personalizado'),
              (2, 11, 1, 'personalizado');

            INSERT INTO servicos_negocio (
              id,
              nome
            )
            VALUES (
              50,
              'Manicure'
            );

            INSERT INTO agendamentos (
              negocio_id,
              profissional_id,
              servico_id,
              servico_nome,
              antecedencia_cancelamento_horas
            )
            VALUES (
              11,
              2,
              50,
              'Manicure',
              2
            );
          `);

          await client.query(
            migration(
              "111_politica_cancelamento_negocio.sql"
            )
          );

          const negocios =
            await client.query(`
              SELECT
                id,
                antecedencia_cancelamento
              FROM negocios
              ORDER BY id
            `);

          expect(
            negocios.rows
          ).toEqual([
            {
              id: "11",
              antecedencia_cancelamento:
                12,
            },
            {
              id: "12",
              antecedencia_cancelamento:
                2,
            },
          ]);

          const configs =
            await client.query(`
              SELECT
                profissional_id,
                antecedencia_cancelamento
              FROM agenda_configuracoes
              WHERE negocio_id = 11
              ORDER BY profissional_id
            `);

          expect(
            configs.rows
          ).toEqual([
            {
              profissional_id:
                "1",
              antecedencia_cancelamento:
                12,
            },
            {
              profissional_id:
                "2",
              antecedencia_cancelamento:
                12,
            },
          ]);

          const antigo =
            await client.query(`
              SELECT
                antecedencia_cancelamento_horas
              FROM agendamentos
              WHERE id = 1
            `);

          expect(
            antigo.rows[0]
              .antecedencia_cancelamento_horas
          ).toBe(2);

          await client.query(`
            CREATE TRIGGER
              trg_preencher_snapshots_agendamento
            BEFORE INSERT ON agendamentos
            FOR EACH ROW
            EXECUTE FUNCTION
              preencher_snapshots_agendamento();

            UPDATE negocios
            SET antecedencia_cancelamento = 48
            WHERE id = 11;

            INSERT INTO agendamentos (
              negocio_id,
              profissional_id,
              servico_id
            )
            VALUES (
              11,
              2,
              50
            );
          `);

          const novo =
            await client.query(`
              SELECT
                servico_nome,
                antecedencia_cancelamento_horas
              FROM agendamentos
              WHERE id = 2
            `);

          expect(
            novo.rows[0]
          ).toEqual({
            servico_nome:
              "Manicure",
            antecedencia_cancelamento_horas:
              48,
          });

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

            INSERT INTO usuarios_negocios (
              usuario_id,
              negocio_id,
              papel,
              ativo
            )
            VALUES (
              3,
              11,
              'profissional',
              TRUE
            );
          `);

          const novaProfissional =
            await client.query(`
              SELECT
                antecedencia_cancelamento,
                origem_horarios
              FROM agenda_configuracoes
              WHERE profissional_id = 3
                AND negocio_id = 11
            `);

          expect(
            novaProfissional.rows[0]
          ).toEqual({
            antecedencia_cancelamento:
              48,
            origem_horarios:
              "padrao_af",
          });

          const horarios =
            await client.query(`
              SELECT COUNT(*)::INT
                AS total
              FROM agenda_horarios
              WHERE profissional_id = 3
                AND negocio_id = 11
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
