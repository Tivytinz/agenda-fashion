const registrador = require("../utils/registrador");
const operationalMetricsService = require(
  "./operationalMetricsService"
);
const repository = require(
  "../repositories/aquisicaoFinanceiraRepository"
);
const {
  PRIMEIRA_EXECUCAO_MS,
  intervaloMs,
  tamanhoLote,
} = require(
  "../config/acquisitionFinancialReconciliation"
);

const NOME_WORKER =
  "acquisition_financial_reconciliation";

let timerInicial = null;
let timerIntervalo = null;
let executando = false;
const execucoesAgendadas = new Set();

function acompanharExecucao(promise) {
  const execucao = Promise.resolve(promise);
  execucoesAgendadas.add(execucao);
  void execucao.then(
    () => execucoesAgendadas.delete(execucao),
    () => execucoesAgendadas.delete(execucao)
  );
  return execucao;
}

async function executarReconciliacao() {
  if (executando) {
    return {
      ignorado: true,
      motivo: "execucao_em_andamento",
    };
  }

  executando = true;
  operationalMetricsService
    .registrarExecucaoIniciada(
      NOME_WORKER
    );

  try {
    const candidatos =
      await repository
        .listarConversoesPendentes(
          tamanhoLote()
        );

    let materializados = 0;
    let falhas = 0;

    for (const candidato of candidatos) {
      try {
        const snapshot =
          await repository
            .materializarAquisicaoPorEvento(
              candidato.evento_id
            );

        if (snapshot) {
          materializados += 1;
        }
      } catch (erro) {
        falhas += 1;
        registrador.aviso(
          "Growth: falha ao materializar aquisição financeira.",
          {
            negocio_id:
              candidato.negocio_id || null,
            evento_id:
              candidato.evento_id || null,
            codigo:
              erro?.code || null,
            erro: String(
              erro?.message ||
              "Erro desconhecido"
            ).slice(0, 240),
          }
        );
      }
    }

    const resultado = {
      ignorado: false,
      candidatos: candidatos.length,
      materializados,
      falhas,
    };

    if (falhas > 0) {
      operationalMetricsService
        .registrarExecucaoFalha(
          NOME_WORKER,
          new Error(
            `${falhas} aquisição(ões) financeira(s) falharam na reconciliação.`
          )
        );
    } else {
      operationalMetricsService
        .registrarExecucaoConcluida(
          NOME_WORKER
        );
    }

    if (candidatos.length > 0) {
      registrador.informacao(
        "Growth: reconciliação de aquisição financeira concluída.",
        resultado
      );
    }

    return resultado;
  } catch (erro) {
    operationalMetricsService
      .registrarExecucaoFalha(
        NOME_WORKER,
        erro
      );
    throw erro;
  } finally {
    executando = false;
  }
}

function iniciarWorkerAquisicaoFinanceira() {
  if (timerInicial || timerIntervalo) {
    return true;
  }

  operationalMetricsService
    .registrarWorkerIniciado(
      NOME_WORKER
    );

  timerInicial = setTimeout(() => {
    void acompanharExecucao(
      executarReconciliacao()
    );
  }, PRIMEIRA_EXECUCAO_MS);

  timerIntervalo = setInterval(() => {
    void acompanharExecucao(
      executarReconciliacao()
    );
  }, intervaloMs());

  timerInicial.unref?.();
  timerIntervalo.unref?.();

  registrador.informacao(
    "Worker de aquisição financeira iniciado.",
    {
      intervalo_ms: intervaloMs(),
      tamanho_lote: tamanhoLote(),
    }
  );

  return true;
}

async function pararWorkerAquisicaoFinanceira() {
  if (timerInicial) {
    clearTimeout(timerInicial);
    timerInicial = null;
  }

  if (timerIntervalo) {
    clearInterval(timerIntervalo);
    timerIntervalo = null;
  }

  await Promise.allSettled(
    Array.from(execucoesAgendadas)
  );

  operationalMetricsService
    .registrarWorkerParado(
      NOME_WORKER
    );
}

module.exports = {
  executarReconciliacao,
  iniciarWorkerAquisicaoFinanceira,
  pararWorkerAquisicaoFinanceira,
};
