const registrador = require("../utils/registrador");
const marketingCostSyncService = require("./marketingCostSyncService");
const marketingCanonicalCleanupService = require(
  "./marketingCanonicalCleanupService"
);
const marketingAttributionRecoveryRepository = require(
  "../repositories/marketingAttributionRecoveryRepository"
);
const {
  PRIMEIRA_EXECUCAO_MS,
  agendamentoAtivo,
  intervaloHoras
} = require("../config/marketingCostSync");

let timerInicial = null;
let timerIntervalo = null;
let executando = false;
let limpezaIniciada = false;

function intervaloMs() {
  return intervaloHoras() * 60 * 60 * 1000;
}

async function executarLimpezaCanonica() {
  if (limpezaIniciada) {
    return null;
  }

  limpezaIniciada = true;

  try {
    const campanhasAceitas = [
      marketingCanonicalCleanupService
        .CAMPANHA_OFICIAL,
      ...marketingCanonicalCleanupService
        .CAMPANHAS_LEGADAS,
    ];

    /*
     * Recuperamos primeiro a evidência histórica ainda bruta. Isso evita que
     * uma limpeza de aliases legados apague o único vínculo auditável entre
     * a sessão anônima do anúncio e a conta criada depois.
     */
    const recuperacaoAntesDaLimpeza =
      await marketingAttributionRecoveryRepository
        .recuperarGoogleProfissionaisPorEventos({
          campanhaOficial:
            marketingCanonicalCleanupService
              .CAMPANHA_OFICIAL,
          campanhasAceitas,
        });

    const resultado =
      await marketingCanonicalCleanupService
        .executarLimpezaGoogleProfissionais();

    const consolidado = {
      ...resultado,
      atribuicoesRecuperadasAntesDaLimpeza:
        recuperacaoAntesDaLimpeza.rowCount || 0,
    };

    registrador.informacao(
      "Marketing: campanha Google de profissionais reconciliada.",
      consolidado
    );

    return consolidado;
  } catch (erro) {
    limpezaIniciada = false;

    registrador.aviso(
      "Marketing: não foi possível concluir a limpeza da campanha Google de profissionais.",
      {
        codigo: erro?.code || null,
        erro: String(
          erro?.message || "Erro desconhecido"
        ).slice(0, 240)
      }
    );

    return null;
  }
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
  void executarLimpezaCanonica();

  if (!agendamentoAtivo()) {
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
  executarLimpezaCanonica,
  executarSincronizacaoAgendada,
  iniciarWorkerCustosMarketing,
  pararWorkerCustosMarketing,
  intervaloHoras
};
