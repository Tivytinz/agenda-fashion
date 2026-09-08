const legacy = require("./marketingCostProviders");
const tiktok = require("./tiktokMarketingCostProvider");

const PROVIDERS = Object.freeze({
  ...legacy.PROVIDERS,
  tiktok_ads: "TikTok Ads"
});

function ehTikTok(provedor) {
  return String(provedor || "").trim().toLowerCase() === "tiktok_ads";
}

async function status() {
  const [tiktokStatus] = await Promise.all([
    tiktok.status()
  ]);
  return [
    ...legacy.status(),
    tiktokStatus
  ];
}

async function listarCustos(provedor, periodo) {
  if (ehTikTok(provedor)) return tiktok.listarCustos(periodo);
  return legacy.listarCustos(provedor, periodo);
}

async function listarCampanhas(provedor) {
  if (ehTikTok(provedor)) return tiktok.listarCampanhas();
  return legacy.listarCampanhas(provedor);
}

async function buscarCampanha(provedor, campanhaExternaId) {
  if (ehTikTok(provedor)) return tiktok.buscarCampanha(campanhaExternaId);
  return legacy.buscarCampanha(provedor, campanhaExternaId);
}

async function testarConexao(provedor) {
  if (ehTikTok(provedor)) return tiktok.testarConexao();
  return legacy.testarConexao(provedor);
}

module.exports = {
  PROVIDERS,
  status,
  listarCustos,
  listarCampanhas,
  buscarCampanha,
  testarConexao,
  googleConfig: legacy.googleConfig,
  metaConfig: legacy.metaConfig,
  tiktokConfig: tiktok.config
};
