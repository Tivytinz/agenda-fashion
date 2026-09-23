const registrador = require("../utils/registrador");
const operationalMetricsService = require(
  "./operationalMetricsService"
);
const assinaturaRepository = require(
  "../repositories/assinaturaRepository"
);
const planoService = require("./planoService");
const assinaturaInadimplenciaService = require(
  "./assinaturaInadimplenciaService"
);
const {
  PRIMEIRA_EXECUCAO_MS,
  intervaloMs,
  tamanhoLote,
  inadimplenciaTerminalDias,
} = require("../config/billingReconciliation");

const NOME_WORKER = "billing_reconciliation";

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
  operationalMetricsService.registrarExecucaoIniciada(
    NOME_WORKER
  );

  try {
    const [
      candidatosCancelamento,
      candidatosInadimplencia,
    ] = await Promise.all([
      assinaturaRepository
        .listarNegociosComCancelamentoExpirado(
          tamanhoLote()
        ),
      assinaturaRepository
        .listarPagamentosInadimplentesMaduros(
          tamanhoLote(),
          inadimplenciaTerminalDias()
        ),
    ]);

    let reconciliados = 0;
    let cancelamentosReconciliados = 0;
    let inadimplenciasTerminalizadas = 0;
    let falhas = 0;

    for (const candidato of candidatosCancelamento) {
      try {
        const expirada =
          await planoService
            .expirarCancelamentoComReconciliacao(
              candidato.negocio_id
            );

        if (expirada) {
          reconciliados += 1;
          cancelamentosReconciliados += 1;
        }
      } catch (erro) {
        falhas += 1;
        registrador.aviso(
          "Billing: falha ao reconciliar término de período pago.",
          {
            negocio_id:
              candidato.negocio_id || null,
            codigo: erro?.code || null,
            erro: String(
              erro?.message || "Erro desconhecido"
            ).slice(0, 240),
          }
        );
      }
    }

    for (const candidato of candidatosInadimplencia) {
      try {
        const encerramento =
          await assinaturaInadimplenciaService
            .reconciliarInadimplenciaTerminal({
              pagamentoId: candidato.pagamento_id,
              janelaDias: inadimplenciaTerminalDias(),
            });

        if (encerramento) {
          reconciliados += 1;
          inadimplenciasTerminalizadas += 1;
        }
      } catch (erro) {
        falhas += 1;
        registrador.aviso(
          "Billing: falha ao materializar inadimplência terminal.",
          {
            negocio_id:
              candidato.negocio_id || null,
            pagamento_id:
              candidato.pagamento_id || null,
            codigo: erro?.code || null,
            erro: String(
              erro?.message || "Erro desconhecido"
            ).slice(0, 240),
          }
        );
      }
    }

    const resultado = {
      ignorado: false,
      candidatos:
        candidatosCancelamento.length +
        candidatosInadimplencia.length,
      cancelamentosReconciliados,
      inadimplenciasTerminalizadas,
      reconciliados,
      falhas,
    };

    if (falhas > 0) {
      operationalMetricsService.registrarExecucaoFalha(
        NOME_WORKER,
        new Error(
          `${falhas} negócio(s) falharam na reconciliação financeira.`
        )
      );
    } else {
      operationalMetricsService.registrarExecucaoConcluida(
        NOME_WORKER
      );
    }

    if (
      candidatosCancelamento.length > 0 ||
      candidatosInadimplencia.length > 0
    ) {
      registrador.informacao(
        "Billing: reconciliação temporal concluída.",
        resultado
      );
    }

    return resultado;
  } catch (erro) {
    operationalMetricsService.registrarExecucaoFalha(
      NOME_WORKER,
      erro
    );
    throw erro;
  } finally {
    executando = false;
  }
}

function iniciarWorkerBillingReconciliation() {
  if (timerInicial || timerIntervalo) {
    return true;
  }

  operationalMetricsService.registrarWorkerIniciado(
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
    "Worker de reconciliação financeira iniciado.",
    {
      intervalo_ms: intervaloMs(),
      tamanho_lote: tamanhoLote(),
      inadimplencia_terminal_dias:
        inadimplenciaTerminalDias(),
    }
  );

  return true;
}

async function pararWorkerBillingReconciliation() {
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
  executarReconciliacao,
  iniciarWorkerBillingReconciliation,
  pararWorkerBillingReconciliation,
};
