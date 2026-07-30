const {
  main,
} = require("./migrate");

async function executarDeploy() {
  const ambienteRailway =
    String(
      process.env
        .RAILWAY_ENVIRONMENT_NAME ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    ambienteRailway !==
    "production"
  ) {
    throw new Error(
      "Migration automática bloqueada fora do ambiente production da Railway."
    );
  }

  process.env
    .MIGRATION_PRODUCTION_CONFIRMATION =
    "agenda-fashion-production";

  await main([
    "up",
    "--env",
    "production",
  ]);
}

if (
  require.main ===
  module
) {
  executarDeploy()
    .catch((erro) => {
      console.error(
        "ERRO:",
        erro.message
      );

      process.exitCode = 1;
    });
}

module.exports = {
  executarDeploy,
};
