const fs = require("fs");
const path = require("path");

const db = require(
  "../src/db/db"
);

function lerMigration(
  nome
) {
  return fs.readFileSync(
    path.join(
      __dirname,
      "../database/migrations",
      nome
    ),
    "utf8"
  );
}

function criarNomeSchema(
  prefixo
) {
  return (
    `${prefixo}_${Date.now()}_` +
    `${Math.floor(
      Math.random() * 100000
    )}`
  );
}

async function comSchemaIsolado(
  prefixo,
  callback
) {
  const client =
    await db.connect();

  const schema =
    criarNomeSchema(
      prefixo
    );

  try {
    await client.query(
      `CREATE SCHEMA "${schema}"`
    );

    await client.query(
      `SET search_path TO "${schema}", public`
    );

    return await callback(
      client
    );
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
}

describe(
  "Migrations 058 e 059 com dados reais",
  () => {
    afterAll(
      async () => {
        await db.end();
      }
    );

    test(
      "058 preserva default puro e recupera somente evidência de edição",
      async () => {
        await comSchemaIsolado(
          "af_migration_058",
          async (client) => {
            await client.query(
              `
                CREATE TABLE agenda_configuracoes (
                  id BIGSERIAL PRIMARY KEY,
                  profissional_id BIGINT NOT NULL,
                  configurado_em TIMESTAMPTZ,
                  created_at TIMESTAMPTZ NOT NULL,
                  updated_at TIMESTAMPTZ NOT NULL
                );

                CREATE TABLE agenda_horarios (
                  profissional_id BIGINT NOT NULL,
                  created_at TIMESTAMPTZ NOT NULL,
                  updated_at TIMESTAMPTZ NOT NULL
                );
              `
            );

            await client.query(
              `
                INSERT INTO agenda_configuracoes (
                  profissional_id,
                  configurado_em,
                  created_at,
                  updated_at
                )
                VALUES
                  (
                    1,
                    NULL,
                    '2026-08-01T10:00:00Z',
                    '2026-08-01T10:00:00Z'
                  ),
                  (
                    2,
                    NULL,
                    '2026-08-01T10:00:00Z',
                    '2026-08-01T10:00:00Z'
                  ),
                  (
                    3,
                    NULL,
                    '2026-08-01T10:00:00Z',
                    '2026-08-03T10:00:00Z'
                  );

                INSERT INTO agenda_horarios (
                  profissional_id,
                  created_at,
                  updated_at
                )
                VALUES
                  (
                    1,
                    '2026-08-01T10:00:00Z',
                    '2026-08-01T10:00:00Z'
                  ),
                  (
                    2,
                    '2026-08-01T10:00:00Z',
                    '2026-08-02T10:00:00Z'
                  );
              `
            );

            await client.query(
              lerMigration(
                "058_backfill_agenda_configurada_legado.sql"
              )
            );

            const resultado =
              await client.query(
                `
                  SELECT
                    profissional_id,
                    configurado_em
                  FROM agenda_configuracoes
                  ORDER BY profissional_id
                `
              );

            expect(
              resultado.rows[0]
                .configurado_em
            ).toBeNull();

            expect(
              resultado.rows[1]
                .configurado_em
                .toISOString()
            ).toBe(
              "2026-08-02T10:00:00.000Z"
            );

            expect(
              resultado.rows[2]
                .configurado_em
                .toISOString()
            ).toBe(
              "2026-08-03T10:00:00.000Z"
            );
          }
        );
      }
    );

    test(
      "059 cancela só divulgação sem agenda confirmada",
      async () => {
        await comSchemaIsolado(
          "af_migration_059",
          async (client) => {
            await client.query(
              `
                CREATE TABLE whatsapp_mensagens (
                  id BIGSERIAL PRIMARY KEY,
                  negocio_id BIGINT,
                  tipo VARCHAR(60) NOT NULL,
                  status VARCHAR(20) NOT NULL,
                  bloqueado_em TIMESTAMPTZ,
                  ultimo_erro TEXT
                );

                CREATE TABLE usuarios_negocios (
                  usuario_id BIGINT NOT NULL,
                  negocio_id BIGINT NOT NULL,
                  ativo BOOLEAN NOT NULL,
                  papel VARCHAR(20) NOT NULL
                );

                CREATE TABLE agenda_configuracoes (
                  profissional_id BIGINT NOT NULL,
                  configurado_em TIMESTAMPTZ
                );
              `
            );

            await client.query(
              `
                INSERT INTO usuarios_negocios (
                  usuario_id,
                  negocio_id,
                  ativo,
                  papel
                )
                VALUES
                  (101, 10, TRUE, 'dono'),
                  (102, 20, TRUE, 'dono'),
                  (103, 30, TRUE, 'dono'),
                  (104, 40, TRUE, 'dono');

                INSERT INTO agenda_configuracoes (
                  profissional_id,
                  configurado_em
                )
                VALUES
                  (101, NULL),
                  (102, '2026-08-20T10:00:00Z'),
                  (103, NULL),
                  (104, NULL);

                INSERT INTO whatsapp_mensagens (
                  negocio_id,
                  tipo,
                  status,
                  bloqueado_em
                )
                VALUES
                  (
                    10,
                    'LEMBRETE_DIVULGAR_NEGOCIO',
                    'PENDING',
                    NOW()
                  ),
                  (
                    20,
                    'LEMBRETE_DIVULGAR_NEGOCIO',
                    'FAILED',
                    NOW()
                  ),
                  (
                    30,
                    'LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO',
                    'PROCESSING',
                    NOW()
                  ),
                  (
                    40,
                    'LEMBRETE_DIVULGAR_NEGOCIO',
                    'SENT',
                    NULL
                  );
              `
            );

            await client.query(
              lerMigration(
                "059_cancelar_divulgacao_sem_agenda.sql"
              )
            );

            const resultado =
              await client.query(
                `
                  SELECT
                    negocio_id,
                    tipo,
                    status,
                    bloqueado_em,
                    ultimo_erro
                  FROM whatsapp_mensagens
                  ORDER BY negocio_id
                `
              );

            expect(
              resultado.rows[0]
            ).toMatchObject({
              negocio_id: "10",
              tipo:
                "LEMBRETE_DIVULGAR_NEGOCIO",
              status:
                "CANCELED",
              bloqueado_em: null,
            });

            expect(
              resultado.rows[0]
                .ultimo_erro
            ).toMatch(
              /agenda confirmada/i
            );

            expect(
              resultado.rows[1]
                .status
            ).toBe("FAILED");

            expect(
              resultado.rows[2]
                .status
            ).toBe("PROCESSING");

            expect(
              resultado.rows[3]
                .status
            ).toBe("SENT");
          }
        );
      }
    );
  }
);
