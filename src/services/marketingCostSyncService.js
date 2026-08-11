const AppError = require("../errors/AppError");
const adminCampaignRepository = require("../repositories/adminCampaignRepository");
const repository = require("../repositories/marketingCostSyncRepository");
const providers = require("./marketingCostProviders");

const PROVEDORES = new Set(["google_ads", "meta_ads"]);

function normalizarProvedor(valor) {
  const provedor = String(valor || "").trim().toLowerCase();
  if (!PROVEDORES.has(provedor)) {
    throw new AppError("Provedor de custos inválido.", 400);
  }
  return provedor;
}

function dataIso(valor) {
  const texto = String(valor || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw new AppError("Data inválida para sincronização.", 400);
  }
  const data = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto) {
    throw new AppError("Data inválida para sincronização.", 400);
  }
  return texto;
}

function periodoPadrao({ dataInicio, dataFim } = {}) {
  const hoje = new Date();
  const fim = dataFim ? dataIso(dataFim) : hoje.toISOString().slice(0, 10);
  const inicioDate = new Date(`${fim}T00:00:00Z`);
  inicioDate.setUTCDate(inicioDate.getUTCDate() - 29);
  const inicio = dataInicio ? dataIso(dataInicio) : inicioDate.toISOString().slice(0, 10);
  const diff = (new Date(`${fim}T00:00:00Z`) - new Date(`${inicio}T00:00:00Z`)) / 86400000;
  if (diff < 0 || diff > 90) {
    throw new AppError("A sincronização aceita períodos de até 90 dias.", 400);
  }
  return { dataInicio: inicio, dataFim: fim };
}

function normalizarTexto(valor, maximo = 240) {
  return String(valor || "").trim().slice(0, maximo);
}

async function statusIntegracoes() {
  const [vinculos, sincronizacoes] = await Promise.all([
    repository.listarVinculos(),
    repository.listarUltimasSincronizacoes()
  ]);
  return {
    provedores: providers.status().map((item) => ({
      ...item,
      vinculos: vinculos.filter((v) => v.provedor === item.provedor).length,
      ultimaSincronizacao: sincronizacoes.find((s) => s.provedor === item.provedor) || null
    })),
    vinculos
  };
}

async function vincularCampanha({ payload }) {
  const campanhaId = Number(payload?.campanhaId ?? payload?.campanha_id);
  if (!Number.isInteger(campanhaId) || campanhaId <= 0) {
    throw new AppError("Campanha inválida.", 400);
  }
  const campanha = await adminCampaignRepository.buscarPorId(campanhaId);
  if (!campanha) throw new AppError("Campanha não encontrada.", 404);

  const provedor = normalizarProvedor(payload?.provedor);
  const contaExternaId = normalizarTexto(payload?.contaExternaId ?? payload?.conta_externa_id, 120).replace(/^act_/, "");
  const campanhaExternaId = normalizarTexto(payload?.campanhaExternaId ?? payload?.campanha_externa_id, 120);
  const campanhaExternaNome = normalizarTexto(payload?.campanhaExternaNome ?? payload?.campanha_externa_nome, 240) || null;
  if (!contaExternaId || !campanhaExternaId) {
    throw new AppError("Informe a conta e o ID externo da campanha.", 400);
  }

  const vinculo = await repository.salvarVinculo({
    campanhaId, provedor, contaExternaId, campanhaExternaId, campanhaExternaNome
  });
  return { vinculo };
}

function erroSeguro(erro) {
  const status = Number(erro?.statusCode || erro?.status || 500);
  const codigo = status >= 400 && status < 600 ? `http_${status}` : "sync_error";
  return {
    codigo,
    mensagem: String(erro?.message || "Falha ao sincronizar custos.").slice(0, 300)
  };
}

async function sincronizar({ provedor: valorProvedor, payload, usuarioId }) {
  const provedor = normalizarProvedor(valorProvedor);
  const periodo = periodoPadrao(payload);
  const run = await repository.iniciarSincronizacao({
    provedor, ...periodo, usuarioId: Number.isInteger(Number(usuarioId)) ? Number(usuarioId) : null
  });

  try {
    const [custos, vinculos] = await Promise.all([
      providers.listarCustos(provedor, periodo),
      repository.buscarVinculosPorProvedor(provedor)
    ]);
    const porExterno = new Map(
      vinculos.map((v) => [
        `${String(v.conta_externa_id)}:${String(v.campanha_externa_id)}`,
        v
      ])
    );

    let importados = 0;
    const naoVinculadas = new Set();
    for (const item of custos) {
      const chave = `${item.contaExternaId}:${item.campanhaExternaId}`;
      const vinculo = porExterno.get(chave);
      if (!vinculo) {
        naoVinculadas.add(chave);
        continue;
      }
      await repository.salvarGastoAutomatico({
        campanhaId: Number(vinculo.campanha_id),
        dataGasto: item.dataGasto,
        valorCentavos: item.valorCentavos,
        provedor
      });
      importados += 1;
    }

    const status = naoVinculadas.size > 0 ? "parcial" : "sucesso";
    await repository.finalizarSincronizacao({
      id: run.id,
      status,
      importados,
      naoVinculadas: naoVinculadas.size
    });
    return {
      provedor,
      status,
      periodo,
      registrosImportados: importados,
      campanhasNaoVinculadas: naoVinculadas.size
    };
  } catch (erro) {
    const seguro = erroSeguro(erro);
    await repository.finalizarSincronizacao({
      id: run.id,
      status: "erro",
      importados: 0,
      naoVinculadas: 0,
      erroCodigo: seguro.codigo,
      erroMensagem: seguro.mensagem
    });
    throw erro;
  }
}

module.exports = {
  statusIntegracoes,
  vincularCampanha,
  sincronizar,
  normalizarProvedor,
  periodoPadrao
};
