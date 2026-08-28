const AppError = require("../errors/AppError");
const costSyncService = require("./marketingCostSyncService");
const campaignSyncService = require("./marketingCampaignSyncService");
const providers = require("./marketingCostProviders");
const repository = require("../repositories/marketingCostSyncRepository");
const campaignLockRepository = require(
  "../repositories/marketingCampaignSyncLockRepository"
);

const INACTIVE_STATUSES = new Set([
  "ARCHIVED",
  "DELETED",
  "ENDED",
  "PAUSED",
  "REMOVED"
]);

function isOperational(item) {
  const status = String(item?.status || "UNKNOWN")
    .trim()
    .toUpperCase();
  return !INACTIVE_STATUSES.has(status);
}

async function reconcileProviderCampaigns({
  provedor,
  usuarioId,
  payload
}) {
  const provider = costSyncService.normalizarProvedor(provedor);
  const periodo = costSyncService.periodoPadrao(payload);
  const bloqueio = await campaignLockRepository.executarComLock(
    provider,
    async () => {
      /*
       * Valida conexão e moeda antes de criar qualquer identidade interna.
       * Assim uma conta incompatível não deixa campanhas importadas pela metade.
       */
      await costSyncService.testarIntegracao({
        provedor: provider
      });

      const [externalCampaigns, costs, links] = await Promise.all([
        providers.listarCampanhas(provider),
        providers.listarCustos(provider, periodo),
        repository.buscarVinculosPorProvedor(provider)
      ]);

      return campaignSyncService.reconcileExternalCampaigns({
        provider,
        externalCampaigns,
        costs,
        links,
        userId: usuarioId,
        isOperational
      });
    }
  );

  if (!bloqueio.executado) {
    throw new AppError(
      "Já existe uma reconciliação de campanhas deste provedor em andamento.",
      409
    );
  }

  return bloqueio.resultado;
}

async function sincronizar(args) {
  const reconciliacao = await reconcileProviderCampaigns({
    provedor: args?.provedor,
    usuarioId: args?.usuarioId,
    payload: args?.payload
  });

  const resultado = await costSyncService.sincronizar(args);
  const provider = costSyncService.normalizarProvedor(args?.provedor);
  const links = await repository.listarVinculos();
  const campanhasSemObjetivo = links.filter((item) =>
    item.provedor === provider &&
    String(item.objetivo || "").toLowerCase() === "indefinido"
  ).length;

  return {
    ...resultado,
    campanhasImportadas: reconciliacao.importedCampaigns,
    vinculosAutomaticos: reconciliacao.automaticLinks,
    campanhasSemObjetivo,
    campanhasNaoResolvidasAutomaticamente: reconciliacao.unresolved
  };
}

module.exports = {
  ...costSyncService,
  sincronizar,
  reconcileProviderCampaigns,
  isOperational
};
