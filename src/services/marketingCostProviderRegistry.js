const AppError = require("../errors/AppError");
const coreProviders = require("./marketingCostProviders");
const tiktokProvider = require("./tiktokMarketingCostProvider");

function ehTikTok(provedor) {
  return provedor === "tiktok_ads";
}

async function status() {
  return [
    ...coreProviders.status(),
    await tiktokProvider.status()
  ];
}

async function listarCustos(provedor, periodo) {
  if (ehTikTok(provedor)) {
    return tiktokProvider.listarCustos(periodo);
  }
  return coreProviders.listarCustos(provedor, periodo);
}

async function listarCampanhas(provedor) {
  if (ehTikTok(provedor)) {
    return tiktokProvider.listarCampanhas();
  }
  return coreProviders.listarCampanhas(provedor);
}

async function buscarCampanha(provedor, campanhaExternaId) {
  if (ehTikTok(provedor)) {
    return tiktokProvider.buscarCampanha(campanhaExternaId);
  }
  return coreProviders.buscarCampanha(provedor, campanhaExternaId);
}

async function testarConexao(provedor) {
  if (ehTikTok(provedor)) {
    return tiktokProvider.testarConexao();
  }
  if (!["google_ads", "meta_ads"].includes(provedor)) {
    throw new AppError("Provedor de custos inválido.", 400);
  }
  return coreProviders.testarConexao(provedor);
}

module.exports = {
  status,
  listarCustos,
  listarCampanhas,
  buscarCampanha,
  testarConexao
};
