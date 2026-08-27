const registrador = require("../utils/registrador");
const marketingCostSyncService = require("./marketingCostSyncService");
const marketingCanonicalCleanupService = require(
  "./marketingCanonicalCleanupService"
);
const marketingGoogleCampaignLinkService = require(
  "./marketingGoogleCampaignLinkService"
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

async function repararVinculoGoogleAutomaticamente(
  contexto
) {
  try {
    const resultado =
      await marketingGoogleCampaignLinkService
        .repararVinculoGoogleProfissionais({
          periodo:
            marketingCostSyncService
              .periodoPadrao({}),
        });

    if (resultado?.reparado) {
      registrador.informacao(
        "Marketing: vínculo com a campanha original do Google Ads reparado automaticamente.",
        {
          contexto,
          campanhaId:
            resultado.campanhaId || null,
          campanhaExternaId:
            resultado.campanhaExternaId || null,
        }
      );
    }

    return resultado;
  } catch (erro) {
    registrador.aviso(
      "Marketing: não foi possível reparar automaticamente o vínculo com a campanha original do Google Ads.",
      {
        contexto,
        codigo: erro?.code || null,
        erro: String(
          erro?.message || "Erro desconhecido"
        ).slice(0, 240)
      }
    );

    return {
      reparado: false,
      jaVinculado: false,
      motivo: "erro_reparo_automatico",
    };
  }
}

async function sincronizarGoogleAposVinculoVerificado() {
  try {
    const resultado =
      await marketingCostSyncService
        .sincronizar({
          provedor: "google_ads",
          payload: {},
          usuarioId: null,
        });

    registrador.informacao(
      "Marketing: Google Ads reconciliado automaticamente após verificar o vínculo original.",
      {
        status: resultado?.status || null,
        registrosImportados:
          resultado?.registrosImportados || 0,
        campanhasNaoVinculadas:
          resultado?.campanhasNaoVinculadas || 0,
      }
    );

    return resultado;
  } catch (erro) {
    registrador.aviso(
      "Marketing: o vínculo Google foi verificado, mas a reconciliação automática falhou.",
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

    /*
     * A campanha interna canônica nunca substitui a identidade do Google Ads.
     * Depois da limpeza, tentamos reconstruir o vínculo usando exclusivamente
     * a campanha original devolvida pela API do Google, com conta e campaign.id
     * reais. A rotina é conservadora e não grava nada quando há ambiguidade.
     */
    const reparoVinculoGoogle =
      await repararVinculoGoogleAutomaticamente(
        "limpeza_canonica"
      );

    /*
     * Uma sincronização anterior pode continuar não auditável mesmo quando o
     * vínculo original já estava correto. Por isso, no startup, reconciliamos
     * tanto um vínculo recém-reparado quanto um vínculo já verificado. Essa
     * execução é independente da flag do agendamento periódico.
     */
    const vinculoGoogleVerificado = Boolean(
      reparoVinculoGoogle?.reparado ||
      reparoVinculoGoogle?.jaVinculado
    );
    const sincronizacaoAposVinculoVerificado =
      vinculoGoogleVerificado
        ? await sincronizarGoogleAposVinculoVerificado()
        : null;

    const consolidado = {
      ...resultado,
      atribuicoesRecuperadasAntesDaLimpeza:
        recuperacaoAntesDaLimpeza.rowCount || 0,
      reparoVinculoGoogle,
      sincronizacaoAposVinculoVerificado,
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
        if (item.provedor === "google_ads") {
          await repararVinculoGoogleAutomaticamente(
            "sincronizacao_agendada"
          );
        }

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
