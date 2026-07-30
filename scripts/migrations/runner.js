const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PADRAO_NOME_MIGRATION =
  /^(\d{3})_([a-z0-9_]+)\.sql$/;

const AMBIENTES_VALIDOS =
  new Set([
    "development",
    "test",
    "production",
  ]);

const CHAVE_LOCK_MIGRATIONS =
  73421601;

function calcularChecksum(
  conteudo
) {
  return crypto
    .createHash("sha256")
    .update(
      conteudo,
      "utf8"
    )
    .digest("hex");
}

function removerTransacaoExterna(
  conteudo,
  arquivo
) {
  const semInicio =
    conteudo.replace(
      /^\s*BEGIN\s*;\s*/i,
      ""
    );

  const removeuInicio =
    semInicio !== conteudo;

  const semFim =
    semInicio.replace(
      /\s*COMMIT\s*;\s*$/i,
      ""
    );

  const removeuFim =
    semFim !== semInicio;

  if (
    removeuInicio !==
    removeuFim
  ) {
    throw new Error(
      `${arquivo}: a migration precisa possuir BEGIN e COMMIT externos, ou nenhum dos dois.`
    );
  }

  if (
    !semFim.trim()
  ) {
    throw new Error(
      `${arquivo}: a migration está vazia.`
    );
  }

  return semFim.trim();
}

function carregarMigrations(
  pasta
) {
  const arquivos =
    fs
      .readdirSync(
        pasta
      )
      .filter(
        (arquivo) =>
          arquivo.endsWith(
            ".sql"
          )
      )
      .sort();

  const versoes =
    new Set();

  return arquivos.map(
    (arquivo) => {
      const correspondencia =
        arquivo.match(
          PADRAO_NOME_MIGRATION
        );

      if (
        !correspondencia
      ) {
        throw new Error(
          `Nome de migration inválido: ${arquivo}. Use 000_descricao.sql.`
        );
      }

      const versao =
        Number(
          correspondencia[1]
        );

      if (
        versoes.has(
          versao
        )
      ) {
        throw new Error(
          `Versão de migration duplicada: ${correspondencia[1]}.`
        );
      }

      versoes.add(
        versao
      );

      const caminho =
        path.join(
          pasta,
          arquivo
        );

      const conteudo =
        fs.readFileSync(
          caminho,
          "utf8"
        );

      return {
        arquivo,
        versao,
        checksum:
          calcularChecksum(
            conteudo
          ),
        sql:
          removerTransacaoExterna(
            conteudo,
            arquivo
          ),
      };
    }
  );
}

function validarAmbiente(
  ambiente,
  confirmacaoProducao
) {
  if (
    !AMBIENTES_VALIDOS.has(
      ambiente
    )
  ) {
    throw new Error(
      `Ambiente de migration inválido: ${ambiente}.`
    );
  }

  if (
    ambiente ===
      "production" &&
    confirmacaoProducao !==
      "agenda-fashion-production"
  ) {
    throw new Error(
      "Migration de produção bloqueada. Configure MIGRATION_PRODUCTION_CONFIRMATION=agenda-fashion-production."
    );
  }
}

async function criarTabelaControle(
  client
) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      versao INTEGER PRIMARY KEY,
      arquivo VARCHAR(255) NOT NULL UNIQUE,
      checksum CHAR(64) NOT NULL,
      ambiente VARCHAR(20) NOT NULL,
      duracao_ms INTEGER,
      aplicada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT schema_migrations_ambiente_valido
        CHECK (
          ambiente IN (
            'development',
            'test',
            'production'
          )
        ),

      CONSTRAINT schema_migrations_checksum_valido
        CHECK (
          checksum ~ '^[a-f0-9]{64}$'
        )
    )
  `);
}

async function obterAplicadas(
  client
) {
  const resultado =
    await client.query(`
      SELECT
        versao,
        arquivo,
        checksum,
        ambiente
      FROM schema_migrations
      ORDER BY versao
    `);

  return resultado.rows;
}

async function possuiTabelasDaAplicacao(
  client
) {
  const resultado =
    await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = CURRENT_SCHEMA()
          AND tablename <> 'schema_migrations'
      ) AS possui_tabelas
    `);

  return Boolean(
    resultado.rows[0]
      ?.possui_tabelas
  );
}

function validarHistorico(
  migrations,
  aplicadas,
  ambiente
) {
  const porVersao =
    new Map(
      migrations.map(
        (migration) => [
          migration.versao,
          migration,
        ]
      )
    );

  for (
    const aplicada
    of aplicadas
  ) {
    if (
      aplicada.ambiente !==
      ambiente
    ) {
      throw new Error(
        `Banco identificado como ${aplicada.ambiente}, mas a execução pediu ${ambiente}.`
      );
    }

    const local =
      porVersao.get(
        Number(
          aplicada.versao
        )
      );

    if (
      !local
    ) {
      throw new Error(
        `A migration aplicada ${aplicada.arquivo} não existe mais no projeto.`
      );
    }

    if (
      local.arquivo !==
      aplicada.arquivo
    ) {
      throw new Error(
        `A migration ${aplicada.versao} foi renomeada após ser aplicada.`
      );
    }

    if (
      local.checksum !==
      aplicada.checksum
        .trim()
    ) {
      throw new Error(
        `A migration aplicada ${aplicada.arquivo} foi alterada. Crie uma nova migration em vez de editar a antiga.`
      );
    }
  }
}

async function registrarBaseline({
  client,
  migrations,
  aplicadas,
  ambiente,
  baselineAte,
}) {
  if (
    aplicadas.length
  ) {
    throw new Error(
      "Baseline bloqueado: o banco já possui histórico de migrations."
    );
  }

  if (
    !Number.isInteger(
      baselineAte
    )
  ) {
    throw new Error(
      "Informe a versão do baseline com --through 000."
    );
  }

  const selecionadas =
    migrations.filter(
      (migration) =>
        migration.versao <=
        baselineAte
    );

  const ultima =
    selecionadas.at(
      -1
    );

  if (
    !ultima ||
    ultima.versao !==
      baselineAte
  ) {
    throw new Error(
      `A migration ${String(
        baselineAte
      ).padStart(
        3,
        "0"
      )} não existe.`
    );
  }

  if (
    !await possuiTabelasDaAplicacao(
      client
    )
  ) {
    throw new Error(
      "Baseline bloqueado: banco vazio deve executar as migrations normalmente."
    );
  }

  await client.query(
    "BEGIN"
  );

  try {
    for (
      const migration
      of selecionadas
    ) {
      await client.query(
        `
          INSERT INTO schema_migrations (
            versao,
            arquivo,
            checksum,
            ambiente,
            duracao_ms
          )
          VALUES ($1, $2, $3, $4, 0)
        `,
        [
          migration.versao,
          migration.arquivo,
          migration.checksum,
          ambiente,
        ]
      );
    }

    await client.query(
      "COMMIT"
    );
  } catch (erro) {
    await client.query(
      "ROLLBACK"
    );

    throw erro;
  }

  return selecionadas;
}

async function aplicarPendentes({
  client,
  migrations,
  aplicadas,
  ambiente,
}) {
  if (
    !aplicadas.length &&
    await possuiTabelasDaAplicacao(
      client
    )
  ) {
    throw new Error(
      "Banco existente sem histórico. Confira o schema e execute o baseline explícito antes de aplicar novas migrations."
    );
  }

  const versoesAplicadas =
    new Set(
      aplicadas.map(
        (migration) =>
          Number(
            migration.versao
          )
      )
    );

  const pendentes =
    migrations.filter(
      (migration) =>
        !versoesAplicadas.has(
          migration.versao
        )
    );

  for (
    const migration
    of pendentes
  ) {
    const inicio =
      Date.now();

    await client.query(
      "BEGIN"
    );

    try {
      await client.query(
        migration.sql
      );

      await client.query(
        `
          INSERT INTO schema_migrations (
            versao,
            arquivo,
            checksum,
            ambiente,
            duracao_ms
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          migration.versao,
          migration.arquivo,
          migration.checksum,
          ambiente,
          Math.max(
            0,
            Date.now() -
              inicio
          ),
        ]
      );

      await client.query(
        "COMMIT"
      );
    } catch (erro) {
      await client.query(
        "ROLLBACK"
      );

      throw new Error(
        `${migration.arquivo}: ${erro.message}`,
        {
          cause: erro,
        }
      );
    }
  }

  return pendentes;
}

async function executarRunner({
  client,
  migrations,
  ambiente,
  modo = "up",
  baselineAte,
}) {
  validarAmbiente(
    ambiente,
    process.env
      .MIGRATION_PRODUCTION_CONFIRMATION
  );

  await client.query(
    "SELECT pg_advisory_lock($1)",
    [
      CHAVE_LOCK_MIGRATIONS,
    ]
  );

  try {
    await criarTabelaControle(
      client
    );

    const aplicadas =
      await obterAplicadas(
        client
      );

    validarHistorico(
      migrations,
      aplicadas,
      ambiente
    );

    if (
      modo ===
      "status"
    ) {
      return {
        aplicadas,
        pendentes:
          migrations.filter(
            (migration) =>
              !aplicadas.some(
                (aplicada) =>
                  Number(
                    aplicada.versao
                  ) ===
                  migration.versao
              )
          ),
      };
    }

    if (
      modo ===
      "baseline"
    ) {
      return {
        baseline:
          await registrarBaseline({
            client,
            migrations,
            aplicadas,
            ambiente,
            baselineAte,
          }),
      };
    }

    if (
      modo !==
      "up"
    ) {
      throw new Error(
        `Comando de migration inválido: ${modo}.`
      );
    }

    return {
      aplicadas:
        await aplicarPendentes({
          client,
          migrations,
          aplicadas,
          ambiente,
        }),
    };
  } finally {
    await client.query(
      "SELECT pg_advisory_unlock($1)",
      [
        CHAVE_LOCK_MIGRATIONS,
      ]
    );
  }
}

module.exports = {
  calcularChecksum,
  carregarMigrations,
  executarRunner,
  removerTransacaoExterna,
  validarAmbiente,
};
