const AppError = require("../errors/AppError");
const coreProviders = require("./marketingCostProviders");
const visualProviders = require("./visualMarketingCostProviders");

const VISUAL_PROVIDERS = new Set(["pinterest_ads", "tiktok_ads"]);

function providerModule(provedor) {
  if (VISUAL_PROVIDERS.has(provedor)) return visualProviders;
  if (["google_ads", "meta_ads"].includes(provedor)) return coreProviders;
  throw new AppError("Provedor de custos inválido.", 400);
}

function status() {
  return [
    ...coreProviders.status(),
    ...visualProviders.status()
  ];
}

async function listarCustos(provedor, periodo) {
  return providerModule(provedor).listarCustos(provedor, periodo);
}

async function listarCampanhas(provedor) {
  return providerModule(provedor).listarCampanhas(provedor);
}

async function buscarCampanha(provedor, campanhaExternaId) {
  return providerModule(provedor).buscarCampanha(
    provedor,
    campanhaExternaId
  );
}

async function testarConexao(provedor) {
  return providerModule(provedor).testarConexao(provedor);
}

module.exports = {
  status,
  listarCustos,
  listarCampanhas,
  buscarCampanha,
  testarConexao
};
