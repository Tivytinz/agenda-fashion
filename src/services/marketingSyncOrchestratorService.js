const costSyncService = require("./marketingCostSyncService");
const campaignSyncService = require("./marketingCampaignSyncService");
const repository = require("../repositories/marketingCostSyncRepository");

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

async function reconcileProviderCampaigns({ provedor, usuarioId }) {
  const provider = costSyncService.normalizarProvedor(provedor);
  const [external, links] = await Promise.all([
    costSyncService.listarCampanhasExternas({ provedor: provider }),
    repository.buscarVinculosPorProvedor(provider)
  ]);

  const accountId = external?.contaExternaId || null;
  const externalCampaigns = (external?.campanhas || []).map((item) => ({
    contaExternaId: accountId,
    campanhaExternaId: item.id,
    campanhaExternaNome: item.nome,
    status: item.status,
    tipo: item.tipo
  }));

  return campaignSyncService.reconcileExternalCampaigns({
    provider,
    externalCampaigns,
    costs: [],
    links,
    userId: usuarioId,
    isOperational
  });
}

async function sincronizar(args) {
  const reconciliacao = await reconcileProviderCampaigns({
    provedor: args?.provedor,
    usuarioId: args?.usuarioId
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
