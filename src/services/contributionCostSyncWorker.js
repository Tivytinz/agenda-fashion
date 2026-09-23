const registrador = require(
  "../utils/registrador"
);
const operationalMetricsService =
  require(
    "./operationalMetricsService"
  );
const syncService = require(
  "./contributionCostSyncService"
);
const {
  PRIMEIRA_EXECUCAO_MS,
  agendamentoAtivo,
  intervaloMinutos,
} = require(
  "../config/contributionCostSync"
);

let timerInicial = null;
let timerIntervalo = null;
let executando = false;
const execucoes =
  new Set();

function intervaloMs() {
  return (
    intervaloMinutos() *
    60 *
    1000
  );
}

function acompanhar(
  promise
) {
  const execucao =
    Promise.resolve(
      promise
    );

  execucoes.add(
    execucao
  );

  void execucao.then(
    () =>
      execucoes.delete(
        execucao
      ),
    () =>
      execucoes.delete(
        execucao
      )
  );

  return execucao;
}

async function executarSincronizacaoAgendada() {
  if (executando) {
    return {
      ignorado: true,
      motivo:
        "execucao_em_andamento",
      resultados: [],
    };
  }

  executando = true;
  operationalMetricsService
    .registrarExecucaoIniciada(
      "contribution_cost_sync"
    );

  try {
    const resultado =
      await syncService
        .sincronizarPendentes();

    const falhas =
      resultado.resultados
        .filter(
          (item) =>
            item.status ===
            "erro"
        );

    if (
      falhas.length > 0
    ) {
      const erro =
        new Error(
          `${falhas.length} integração(ões) de contribuição falharam.`
        );

      operationalMetricsService
        .registrarExecucaoFalha(
          "contribution_cost_sync",
          erro
        );

      registrador.aviso(
        "Uma ou mais sincronizações de custos de contribuição falharam.",
        {
          falhas:
            falhas.map(
              (item) => ({
                integracaoId:
                  item
                    .integracaoId,
                fonteCodigo:
                  item
                    .fonteCodigo,
                adaptador:
                  item
                    .adaptador,
                erroCodigo:
                  item
                    .erroCodigo,
              })
            ),
        }
      );
    } else {
      operationalMetricsService
        .registrarExecucaoConcluida(
          "contribution_cost_sync"
        );
    }

    return {
      ignorado: false,
      ...resultado,
    };
  } catch (erro) {
    operationalMetricsService
      .registrarExecucaoFalha(
        "contribution_cost_sync",
        erro
      );

    throw erro;
  } finally {
    executando = false;
  }
}

function iniciarWorkerCustosContribuicao() {
  if (
    !agendamentoAtivo()
  ) {
    operationalMetricsService
      .registrarWorkerParado(
        "contribution_cost_sync"
      );

    return false;
  }

  if (
    timerInicial ||
    timerIntervalo
  ) {
    return true;
  }

  operationalMetricsService
    .registrarWorkerIniciado(
      "contribution_cost_sync"
    );

  timerInicial =
    setTimeout(
      () => {
        void acompanhar(
          executarSincronizacaoAgendada()
        );
      },
      PRIMEIRA_EXECUCAO_MS
    );

  timerIntervalo =
    setInterval(
      () => {
        void acompanhar(
          executarSincronizacaoAgendada()
        );
      },
      intervaloMs()
    );

  timerInicial.unref?.();
  timerIntervalo.unref?.();

  registrador.informacao(
    "Worker de custos de contribuição iniciado.",
    {
      intervaloMinutos:
        intervaloMinutos(),
    }
  );

  return true;
}

async function pararWorkerCustosContribuicao() {
  if (timerInicial) {
    clearTimeout(
      timerInicial
    );
    timerInicial = null;
  }

  if (timerIntervalo) {
    clearInterval(
      timerIntervalo
    );
    timerIntervalo = null;
  }

  operationalMetricsService
    .registrarWorkerParado(
      "contribution_cost_sync"
    );

  await Promise.allSettled(
    Array.from(
      execucoes
    )
  );

  return true;
}

module.exports = {
  executarSincronizacaoAgendada,
  iniciarWorkerCustosContribuicao,
  pararWorkerCustosContribuicao,
  intervaloMinutos,
};
