const legacy = require("./marketingCostProviders");
const tiktok = require("./tiktokMarketingCostProvider");
const pinterest = require("./pinterestMarketingCostProvider");

const EXTRAS = Object.freeze({
  tiktok_ads: tiktok,
  pinterest_ads: pinterest
});

const PROVIDERS = Object.freeze({
  ...legacy.PROVIDERS,
  tiktok_ads: "TikTok Ads",
  pinterest_ads: "Pinterest Ads"
});

function providerExtra(provedor) {
  return EXTRAS[String(provedor || "").trim().toLowerCase()] || null;
}

async function status() {
  const extras = await Promise.all(
    Object.values(EXTRAS).map((provider) => provider.status())
  );
  return [...legacy.status(), ...extras];
}

async function listarCustos(provedor, periodo) {
  const extra = providerExtra(provedor);
  if (extra) return extra.listarCustos(periodo);
  return legacy.listarCustos(provedor, periodo);
}

async function listarCampanhas(provedor) {
  const extra = providerExtra(provedor);
  if (extra) return extra.listarCampanhas();
  return legacy.listarCampanhas(provedor);
}

async function buscarCampanha(provedor, campanhaExternaId) {
  const extra = providerExtra(provedor);
  if (extra) return extra.buscarCampanha(campanhaExternaId);
  return legacy.buscarCampanha(provedor, campanhaExternaId);
}

async function testarConexao(provedor) {
  const extra = providerExtra(provedor);
  if (extra) return extra.testarConexao();
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
  tiktokConfig: tiktok.config,
  pinterestConfig: pinterest.config
};
