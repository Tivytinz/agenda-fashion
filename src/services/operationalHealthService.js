const operationalMetricsRepository = require(
  "../repositories/operationalMetricsRepository"
);
const operationalMetricsService = require(
  "./operationalMetricsService"
);

function atrasoSegundos(data, agora = Date.now()) {
  const instante = new Date(data || "").getTime();
  return Number.isFinite(instante)
    ? Math.max(0, Math.round((agora - instante) / 1000))
    : null;
}

async function obterSaudeOperacional() {
  const filas = await operationalMetricsRepository.buscarFilas();

  return {
    coletadoEm: new Date().toISOString(),
    processo: {
      pid: process.pid,
      uptimeSegundos: Math.round(process.uptime()),
      memoria: process.memoryUsage(),
    },
    workers: operationalMetricsService.obterSnapshotWorkers(),
    filas: filas.map((fila) => ({
      nome: fila.fila,
      pendentes: Number(fila.pendentes || 0),
      falhas: Number(fila.falhas || 0),
      maisAntigoEm: fila.mais_antigo_em || null,
      atrasoMaisAntigoSegundos: atrasoSegundos(fila.mais_antigo_em),
    })),
  };
}

module.exports = {
  obterSaudeOperacional,
  atrasoSegundos,
};
