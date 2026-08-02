const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  carregarMigrations,
  executarRunner,
  removerTransacaoExterna,
  validarAmbiente,
} = require(
  "../scripts/migrations/runner"
);

function criarClient({
  aplicadas = [],
  possuiTabelas = false,
  falharEm = null,
} = {}) {
  const consultas = [];

  return {
    consultas,
    query: jest.fn(
      async (
        texto,
        parametros
      ) => {
        consultas.push({
          texto,
          parametros,
        });

        if (
          falharEm &&
          texto.includes(
            falharEm
          )
        ) {
          throw new Error(
            "falha simulada"
          );
        }

        if (
          texto.includes(
            "FROM schema_migrations"
          )
        ) {
          return {
            rows: aplicadas,
          };
        }

        if (
          texto.includes(
            "FROM pg_tables"
          )
        ) {
          return {
            rows: [
              {
                possui_tabelas:
                  possuiTabelas,
              },
            ],
          };
        }

        return {
          rows: [],
        };
      }
    ),
  };
}

function criarMigrations() {
  return [
    {
      versao: 1,
      arquivo:
        "001_inicial.sql",
      checksum:
        "a".repeat(
          64
        ),
      sql:
        "CREATE TABLE exemplo (id INTEGER)",
    },
    {
      versao: 2,
      arquivo:
        "002_campo.sql",
      checksum:
        "b".repeat(
          64
        ),
      sql:
        "ALTER TABLE exemplo ADD COLUMN nome TEXT",
    },
  ];
}

describe(
  "runner de migrations",
  () => {
    const confirmacaoAnterior =
      process.env
        .MIGRATION_PRODUCTION_CONFIRMATION;

    afterEach(
      () => {
        if (
          confirmacaoAnterior ===
          undefined
        ) {
          delete process.env
            .MIGRATION_PRODUCTION_CONFIRMATION;
        } else {
          process.env
            .MIGRATION_PRODUCTION_CONFIRMATION =
            confirmacaoAnterior;
        }
      }
    );

    test(
      "carrega migrations em ordem e recusa versão duplicada",
      () => {
        const pasta =
          fs.mkdtempSync(
            path.join(
              os.tmpdir(),
              "agenda-migrations-"
            )
          );

        fs.writeFileSync(
          path.join(
            pasta,
            "002_segunda.sql"
          ),
          "BEGIN; SELECT 2; COMMIT;"
        );

        fs.writeFileSync(
          path.join(
            pasta,
            "001_primeira.sql"
          ),
          "BEGIN; SELECT 1; COMMIT;"
        );

        const migrations =
          carregarMigrations(
            pasta
          );

        expect(
          migrations.map(
            (migration) =>
              migration.versao
          )
        ).toEqual([
          1,
          2,
        ]);

        expect(
          migrations[0].sql
        ).toBe(
          "SELECT 1;"
        );

        fs.writeFileSync(
          path.join(
            pasta,
            "001_repetida.sql"
          ),
          "SELECT 3;"
        );

        expect(
          () =>
            carregarMigrations(
              pasta
            )
        ).toThrow(
          "Versão de migration duplicada"
        );

        fs.rmSync(
          pasta,
          {
            recursive: true,
            force: true,
          }
        );
      }
    );

    test(
      "exige BEGIN e COMMIT externos em conjunto",
      () => {
        expect(
          () =>
            removerTransacaoExterna(
              "BEGIN; SELECT 1;",
              "001_teste.sql"
            )
        ).toThrow(
          "BEGIN e COMMIT"
        );
      }
    );

    test(
      "aplica somente migrations pendentes e registra na mesma transação",
      async () => {
        const migrations =
          criarMigrations();

        const client =
          criarClient({
            aplicadas: [
              {
                versao: 1,
                arquivo:
                  migrations[0]
                    .arquivo,
                checksum:
                  migrations[0]
                    .checksum,
                ambiente:
                  "test",
              },
            ],
          });

        const resultado =
          await executarRunner({
            client,
            migrations,
            ambiente:
              "test",
          });

        expect(
          resultado.aplicadas
        ).toEqual([
          migrations[1],
        ]);

        const textos =
          client.consultas.map(
            ({ texto }) =>
              texto.trim()
          );

        expect(
          textos
        ).toContain(
          migrations[1].sql
        );

        expect(
          textos
        ).not.toContain(
          migrations[0].sql
        );

        expect(
          textos
        ).toContain(
          "BEGIN"
        );

        expect(
          textos
        ).toContain(
          "COMMIT"
        );
      }
    );

    test(
      "bloqueia migration aplicada que foi alterada",
      async () => {
        const migrations =
          criarMigrations();

        const client =
          criarClient({
            aplicadas: [
              {
                versao: 1,
                arquivo:
                  migrations[0]
                    .arquivo,
                checksum:
                  "c".repeat(
                    64
                  ),
                ambiente:
                  "test",
              },
            ],
          });

        await expect(
          executarRunner({
            client,
            migrations,
            ambiente:
              "test",
          })
        ).rejects.toThrow(
          "foi alterada"
        );

        expect(
          client.consultas.some(
            ({ texto }) =>
              texto.includes(
                "pg_advisory_unlock"
              )
          )
        ).toBe(
          true
        );
      }
    );

    test(
      "bloqueia ambiente diferente do registrado no banco",
      async () => {
        const migrations =
          criarMigrations();

        const client =
          criarClient({
            aplicadas: [
              {
                versao: 1,
                arquivo:
                  migrations[0]
                    .arquivo,
                checksum:
                  migrations[0]
                    .checksum,
                ambiente:
                  "production",
              },
            ],
          });

        await expect(
          executarRunner({
            client,
            migrations,
            ambiente:
              "test",
          })
        ).rejects.toThrow(
          "Banco identificado como production"
        );
      }
    );

    test(
      "exige baseline para banco existente sem histórico",
      async () => {
        const client =
          criarClient({
            possuiTabelas: true,
          });

        await expect(
          executarRunner({
            client,
            migrations:
              criarMigrations(),
            ambiente:
              "test",
          })
        ).rejects.toThrow(
          "marco inicial"
        );
      }
    );

    test(
      "baseline registra migrations existentes sem executar o SQL delas",
      async () => {
        const migrations =
          criarMigrations();

        const client =
          criarClient({
            possuiTabelas: true,
          });

        const resultado =
          await executarRunner({
            client,
            migrations,
            ambiente:
              "test",
            modo:
              "baseline",
            baselineAte: 2,
          });

        expect(
          resultado.baseline
        ).toEqual(
          migrations
        );

        const textos =
          client.consultas.map(
            ({ texto }) =>
              texto.trim()
          );

        expect(
          textos
        ).not.toContain(
          migrations[0].sql
        );

        expect(
          textos
        ).not.toContain(
          migrations[1].sql
        );

        const inserts =
          client.consultas.filter(
            ({ texto }) =>
              texto.includes(
                "INSERT INTO schema_migrations"
              )
          );

        expect(
          inserts
        ).toHaveLength(
          2
        );
      }
    );

    test(
      "faz rollback e libera o lock quando uma migration falha",
      async () => {
        const migrations =
          criarMigrations();

        const client =
          criarClient({
            falharEm:
              "CREATE TABLE exemplo",
          });

        await expect(
          executarRunner({
            client,
            migrations,
            ambiente:
              "test",
          })
        ).rejects.toThrow(
          "001_inicial.sql: falha simulada"
        );

        const textos =
          client.consultas.map(
            ({ texto }) =>
              texto.trim()
          );

        expect(
          textos
        ).toContain(
          "ROLLBACK"
        );

        expect(
          textos.some(
            (texto) =>
              texto.includes(
                "pg_advisory_unlock"
              )
          )
        ).toBe(
          true
        );
      }
    );

    test(
      "exige confirmação explícita para produção",
      () => {
        delete process.env
          .MIGRATION_PRODUCTION_CONFIRMATION;

        expect(
          () =>
            validarAmbiente(
              "production",
              process.env
                .MIGRATION_PRODUCTION_CONFIRMATION
            )
        ).toThrow(
          "Migration de produção bloqueada"
        );

        expect(
          () =>
            validarAmbiente(
              "production",
              "agenda-fashion-production"
            )
        ).not.toThrow();
      }
    );
  }
);
