const registrador = require("../utils/registrador");
const operationalMetricsService = require(
  "./operationalMetricsService"
);
const mlNoShowDataService = require(
  "./mlNoShowDataService"
);
const {
  PRIMEIRA_EXECUCAO_MS,
  coletaAtiva,
  intervaloMs,
  tamanhoLote,
} = require("../config/mlNoShow");

const NOME_WORKER = "ml_no_show_dados";

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

async function executarColeta() {
  if (executando) {
    return {
      ignorado: true,
      motivo: "execucao_em_andamento",
    };
  }

  executando = true;
  operationalMetricsService.registrarExecucaoIniciada(
    NOME_WORKER
  );

  try {
    const resultado = await mlNoShowDataService.coletar({
      limite: tamanhoLote(),
    });

    operationalMetricsService.registrarExecucaoConcluida(
      NOME_WORKER
    );

    registrador.informacao(
      "ML no-show: coleta de dados concluída.",
      {
        amostras_capturadas:
          resultado.amostras_capturadas,
        amostras_rotuladas:
          resultado.amostras_rotuladas_nesta_execucao,
        pronta_para_treinamento:
          resultado.prontidao.pronta_para_treinamento,
        total_rotuladas:
          resultado.prontidao.dados.amostras_rotuladas,
        cobertura_desfecho:
          resultado.prontidao.dados.cobertura_desfecho,
      }
    );

    return {
      ignorado: false,
      ...resultado,
    };
  } catch (erro) {
    operationalMetricsService.registrarExecucaoFalha(
      NOME_WORKER,
      erro
    );
    registrador.aviso(
      "ML no-show: falha na coleta de dados.",
      {
        codigo: erro?.code || null,
        erro: String(
          erro?.message || "Erro desconhecido"
        ).slice(0, 240),
      }
    );
    throw erro;
  } finally {
    executando = false;
  }
}

function iniciarWorkerMlNoShow() {
  if (!coletaAtiva()) {
    operationalMetricsService.registrarWorkerParado(
      NOME_WORKER
    );
    return false;
  }

  if (timerInicial || timerIntervalo) {
    return true;
  }

  operationalMetricsService.registrarWorkerIniciado(
    NOME_WORKER
  );

  timerInicial = setTimeout(() => {
    void acompanharExecucao(executarColeta());
  }, PRIMEIRA_EXECUCAO_MS);

  timerIntervalo = setInterval(() => {
    void acompanharExecucao(executarColeta());
  }, intervaloMs());

  timerInicial.unref?.();
  timerIntervalo.unref?.();

  registrador.informacao(
    "Worker de dados de ML no-show iniciado.",
    {
      intervalo_ms: intervaloMs(),
      tamanho_lote: tamanhoLote(),
    }
  );

  return true;
}

async function pararWorkerMlNoShow() {
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

  operationalMetricsService.registrarWorkerParado(
    NOME_WORKER
  );
}

module.exports = {
  executarColeta,
  iniciarWorkerMlNoShow,
  pararWorkerMlNoShow,
};
