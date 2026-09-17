const workers = new Map();

function agoraIso() {
  return new Date().toISOString();
}

function estado(nome) {
  if (!workers.has(nome)) {
    workers.set(nome, {
      nome,
      ativo: false,
      emExecucao: 0,
      execucoes: 0,
      falhas: 0,
      iniciadoEm: null,
      paradoEm: null,
      ultimaExecucaoEm: null,
      ultimoSucessoEm: null,
      ultimaFalhaEm: null,
      ultimoErro: null,
    });
  }

  return workers.get(nome);
}

function registrarWorkerIniciado(nome) {
  const atual = estado(nome);
  atual.ativo = true;
  atual.iniciadoEm = agoraIso();
  atual.paradoEm = null;
}

function registrarWorkerParado(nome) {
  const atual = estado(nome);
  atual.ativo = false;
  atual.paradoEm = agoraIso();
}

function registrarExecucaoIniciada(nome) {
  const atual = estado(nome);
  atual.emExecucao += 1;
  atual.execucoes += 1;
  atual.ultimaExecucaoEm = agoraIso();
}

function registrarExecucaoConcluida(nome) {
  const atual = estado(nome);
  atual.emExecucao = Math.max(0, atual.emExecucao - 1);
  atual.ultimoSucessoEm = agoraIso();
  atual.ultimoErro = null;
}

function registrarExecucaoFalha(nome, erro) {
  const atual = estado(nome);
  atual.emExecucao = Math.max(0, atual.emExecucao - 1);
  atual.falhas += 1;
  atual.ultimaFalhaEm = agoraIso();
  atual.ultimoErro = String(
    erro?.message || erro || "Erro desconhecido."
  ).slice(0, 240);
}

function obterSnapshotWorkers() {
  return Array.from(workers.values())
    .map((item) => ({ ...item }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

function limparMetricasParaTeste() {
  workers.clear();
}

module.exports = {
  registrarWorkerIniciado,
  registrarWorkerParado,
  registrarExecucaoIniciada,
  registrarExecucaoConcluida,
  registrarExecucaoFalha,
  obterSnapshotWorkers,
  limparMetricasParaTeste,
};
