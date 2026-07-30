const path = require("path");
const dotenv = require("dotenv");
const { Client } = require("pg");

const {
  carregarMigrations,
  executarRunner,
} = require("./migrations/runner");

function obterArgumento(
  argumentos,
  nome
) {
  const indice =
    argumentos.indexOf(
      nome
    );

  if (
    indice === -1
  ) {
    return null;
  }

  return argumentos[
    indice + 1
  ] || null;
}

function obterConfiguracao(
  argumentos = process.argv.slice(2)
) {
  const modo =
    argumentos[0] &&
    !argumentos[0]
      .startsWith("--")
      ? argumentos[0]
      : "up";

  const ambiente =
    obterArgumento(
      argumentos,
      "--env"
    ) ||
    process.env.NODE_ENV ||
    "development";

  const arquivoEnv =
    ambiente ===
    "test"
      ? ".env.test"
      : ".env";

  dotenv.config({
    path: path.resolve(
      __dirname,
      "..",
      arquivoEnv
    ),
    override:
      ambiente ===
      "test",
    quiet: true,
  });

  const databaseUrl =
    String(
      process.env
        .DATABASE_URL ||
      ""
    ).trim();

  if (
    !databaseUrl
  ) {
    throw new Error(
      "DATABASE_URL não foi configurada."
    );
  }

  const through =
    obterArgumento(
      argumentos,
      "--through"
    );

  return {
    ambiente,
    databaseUrl,
    modo,
    baselineAte:
      through === null
        ? undefined
        : Number(
            through
          ),
  };
}

function exibirResultado(
  configuracao,
  resultado
) {
  if (
    configuracao.modo ===
    "status"
  ) {
    console.log(
      `Aplicadas: ${resultado.aplicadas.length}`
    );

    console.log(
      `Pendentes: ${resultado.pendentes.length}`
    );

    for (
      const migration
      of resultado.pendentes
    ) {
      console.log(
        `- ${migration.arquivo}`
      );
    }

    return;
  }

  if (
    configuracao.modo ===
    "baseline"
  ) {
    console.log(
      `Baseline registrado até ${String(
        configuracao.baselineAte
      ).padStart(
        3,
        "0"
      )}: ${resultado.baseline.length} migrations.`
    );

    return;
  }

  if (
    !resultado.aplicadas.length
  ) {
    console.log(
      "Banco atualizado: nenhuma migration pendente."
    );

    return;
  }

  for (
    const migration
    of resultado.aplicadas
  ) {
    console.log(
      `Aplicada: ${migration.arquivo}`
    );
  }

  console.log(
    `${resultado.aplicadas.length} migration(s) aplicada(s) com sucesso.`
  );
}

async function main(
  argumentos
) {
  const configuracao =
    obterConfiguracao(
      argumentos
    );

  const migrations =
    carregarMigrations(
      path.resolve(
        __dirname,
        "../database/migrations"
      )
    );

  const client =
    new Client({
      connectionString:
        configuracao.databaseUrl,
      ssl:
        configuracao.ambiente ===
        "production"
          ? {
              rejectUnauthorized:
                false,
            }
          : false,
    });

  await client.connect();

  try {
    const resultado =
      await executarRunner({
        client,
        migrations,
        ambiente:
          configuracao.ambiente,
        modo:
          configuracao.modo,
        baselineAte:
          configuracao.baselineAte,
      });

    exibirResultado(
      configuracao,
      resultado
    );
  } finally {
    await client.end();
  }
}

if (
  require.main ===
  module
) {
  main()
    .catch(
      (erro) => {
        console.error(
          "ERRO:",
          erro.message
        );

        process.exitCode = 1;
      }
    );
}

module.exports = {
  main,
  obterConfiguracao,
};
