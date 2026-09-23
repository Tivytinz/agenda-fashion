const registrador = require(
  "../utils/registrador"
);
const operationalMetricsService = require(
  "./operationalMetricsService"
);
const repository = require(
  "../repositories/paymentEconomicsRepository"
);
const service = require(
  "./paymentEconomicsService"
);
const {
  PRIMEIRA_EXECUCAO_MS,
  intervaloMs,
  tamanhoLote,
} = require(
  "../config/paymentEconomicsReconciliation"
);

const NOME_WORKER =
  "payment_economics_reconciliation";

let timerInicial = null;
let timerIntervalo = null;
let executando = false;
const execucoesAgendadas =
  new Set();

function acompanharExecucao(promise) {
  const execucao =
    Promise.resolve(promise);
  execucoesAgendadas.add(execucao);
  void execucao.then(
    () =>
      execucoesAgendadas.delete(
        execucao
      ),
    () =>
      execucoesAgendadas.delete(
        execucao
      )
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
      await repository.listarPendentes(
        tamanhoLote()
      );

    let reconciliados = 0;
    let obsoletos = 0;
    let falhas = 0;

    for (const candidato of candidatos) {
      try {
        const resultado =
          await service
            .reconciliarPagamento(
              candidato
            );

        if (resultado?.obsoleto) {
          obsoletos += 1;
        } else if (resultado) {
          reconciliados += 1;
        }
      } catch (erro) {
        falhas += 1;
        registrador.aviso(
          "Financeiro: falha ao reconciliar economia do pagamento.",
          {
            pagamento_id:
              candidato.pagamento_id ||
              null,
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
      candidatos:
        candidatos.length,
      reconciliados,
      obsoletos,
      falhas,
    };

    if (falhas > 0) {
      operationalMetricsService
        .registrarExecucaoFalha(
          NOME_WORKER,
          new Error(
            `${falhas} pagamento(s) falharam na reconciliação econômica.`
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
        "Financeiro: reconciliação econômica concluída.",
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

function iniciarWorkerPaymentEconomics() {
  if (
    timerInicial ||
    timerIntervalo
  ) {
    return true;
  }

  operationalMetricsService
    .registrarWorkerIniciado(
      NOME_WORKER
    );

  timerInicial = setTimeout(
    () => {
      void acompanharExecucao(
        executarReconciliacao()
      );
    },
    PRIMEIRA_EXECUCAO_MS
  );

  timerIntervalo = setInterval(
    () => {
      void acompanharExecucao(
        executarReconciliacao()
      );
    },
    intervaloMs()
  );

  timerInicial.unref?.();
  timerIntervalo.unref?.();

  registrador.informacao(
    "Worker de economia líquida iniciado.",
    {
      intervalo_ms: intervaloMs(),
      tamanho_lote: tamanhoLote(),
    }
  );

  return true;
}

async function pararWorkerPaymentEconomics() {
  if (timerInicial) {
    clearTimeout(timerInicial);
    timerInicial = null;
  }

  if (timerIntervalo) {
    clearInterval(timerIntervalo);
    timerIntervalo = null;
  }

  await Promise.allSettled(
    Array.from(
      execucoesAgendadas
    )
  );

  operationalMetricsService
    .registrarWorkerParado(
      NOME_WORKER
    );
}

module.exports = {
  executarReconciliacao,
  iniciarWorkerPaymentEconomics,
  pararWorkerPaymentEconomics,
};
