const registrador = require("../utils/registrador");
const marketingCostSyncService = require("./marketingCostSyncService");

const PRIMEIRA_EXECUCAO_MS = 60000;
const HORAS_PADRAO = 6;
const HORAS_MINIMAS = 1;
const HORAS_MAXIMAS = 24;

let timerInicial = null;
let timerIntervalo = null;
let executando = false;

function flagAtiva(valor) {
  return ["1", "true", "yes", "on"].includes(
    String(valor || "").trim().toLowerCase()
  );
}

function intervaloHoras() {
  const valor = Number(
    process.env.MARKETING_COST_SYNC_INTERVAL_HOURS ||
      HORAS_PADRAO
  );

  if (!Number.isFinite(valor)) {
    return HORAS_PADRAO;
  }

  return Math.min(
    HORAS_MAXIMAS,
    Math.max(HORAS_MINIMAS, valor)
  );
}

function intervaloMs() {
  return intervaloHoras() * 60 * 60 * 1000;
}

async function executarSincronizacaoAgendada() {
  if (executando) {
    return {
      ignorado: true,
      motivo: "execucao_em_andamento"
    };
  }

  executando = true;

  try {
    const status =
      await marketingCostSyncService.statusIntegracoes();

    const provedores =
      (status?.provedores || []).filter(
        (item) => item?.configurado
      );

    const resultados = [];

    for (const item of provedores) {
      try {
        const resultado =
          await marketingCostSyncService.sincronizar({
            provedor: item.provedor,
            payload: {},
            usuarioId: null
          });

        resultados.push({
          provedor: item.provedor,
          status: resultado.status,
          registrosImportados:
            resultado.registrosImportados || 0,
          campanhasNaoVinculadas:
            resultado.campanhasNaoVinculadas || 0
        });
      } catch (erro) {
        registrador.aviso(
          "Falha na sincronização agendada de custos de marketing.",
          {
            provedor: item.provedor,
            erro: String(
              erro?.message || "Erro desconhecido"
            ).slice(0, 200)
          }
        );

        resultados.push({
          provedor: item.provedor,
          status: "erro"
        });
      }
    }

    return {
      ignorado: false,
      resultados
    };
  } finally {
    executando = false;
  }
}

function iniciarWorkerCustosMarketing() {
  if (
    !flagAtiva(
      process.env.MARKETING_COST_SYNC_SCHEDULE_ENABLED
    )
  ) {
    return false;
  }

  pararWorkerCustosMarketing();

  timerInicial = setTimeout(() => {
    void executarSincronizacaoAgendada();
  }, PRIMEIRA_EXECUCAO_MS);

  timerIntervalo = setInterval(() => {
    void executarSincronizacaoAgendada();
  }, intervaloMs());

  timerInicial.unref?.();
  timerIntervalo.unref?.();

  registrador.informacao(
    "Worker de custos de marketing iniciado.",
    {
      intervaloHoras: intervaloHoras()
    }
  );

  return true;
}

function pararWorkerCustosMarketing() {
  if (timerInicial) {
    clearTimeout(timerInicial);
    timerInicial = null;
  }

  if (timerIntervalo) {
    clearInterval(timerIntervalo);
    timerIntervalo = null;
  }
}

module.exports = {
  executarSincronizacaoAgendada,
  iniciarWorkerCustosMarketing,
  pararWorkerCustosMarketing,
  intervaloHoras
};
