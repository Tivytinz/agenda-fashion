require("dotenv").config({ quiet: true });

const { validarConfiguracaoRuntime } = require("./config/runtime");
const db = require("./db/db");
const readinessService = require("./services/readinessService");
const registrador = require("./utils/registrador");
const {
  iniciarWorkers,
  pararWorkers,
} = require("./workers/backgroundWorkers");

validarConfiguracaoRuntime();

let encerrando = false;
let manterProcessoAtivo = null;

async function iniciar() {
  const estadoBanco = await readinessService.verificarBanco(db);
  if (!estadoBanco.pronto) {
    throw new Error(
      `Banco com migration ${estadoBanco.migrationAtual}; esperado ${estadoBanco.versaoEsperada}.`
    );
  }

  iniciarWorkers();
  manterProcessoAtivo = setInterval(() => {}, 60000);
  registrador.informacao("Processo dedicado de workers iniciado.");
}

async function encerrar(sinal) {
  if (encerrando) return;
  encerrando = true;
  registrador.informacao("Encerrando processo dedicado de workers.", { sinal });
  if (manterProcessoAtivo) {
    clearInterval(manterProcessoAtivo);
    manterProcessoAtivo = null;
  }
  await pararWorkers();
  await db.end();
}

if (require.main === module) {
  iniciar().catch((erro) => {
    registrador.erro("Falha ao iniciar workers:", erro);
    process.exitCode = 1;
  });

  for (const sinal of ["SIGTERM", "SIGINT"]) {
    process.once(sinal, () => {
      encerrar(sinal).catch((erro) => {
        registrador.erro("Falha ao encerrar workers:", erro);
        process.exitCode = 1;
      });
    });
  }
}

module.exports = { iniciar, encerrar };
