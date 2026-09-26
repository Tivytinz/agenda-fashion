let iniciadoEm =
  new Date().toISOString();

const transportes = {
  cookie: {
    requisicoes: 0,
    primeiraObservacaoEm: null,
    ultimaObservacaoEm: null,
  },
  bearer: {
    requisicoes: 0,
    primeiraObservacaoEm: null,
    ultimaObservacaoEm: null,
  },
};

function registrarTransporte(
  origem
) {
  if (
    !Object.hasOwn(
      transportes,
      origem
    )
  ) {
    return;
  }

  const agora =
    new Date().toISOString();
  const atual =
    transportes[origem];

  atual.requisicoes += 1;
  atual.primeiraObservacaoEm =
    atual.primeiraObservacaoEm ||
    agora;
  atual.ultimaObservacaoEm =
    agora;
}

function snapshotItem(
  origem
) {
  const atual =
    transportes[origem];

  return {
    requisicoes:
      atual.requisicoes,
    primeiraObservacaoEm:
      atual.primeiraObservacaoEm,
    ultimaObservacaoEm:
      atual.ultimaObservacaoEm,
  };
}

function obterSnapshot() {
  const cookie =
    snapshotItem("cookie");
  const bearerLegado =
    snapshotItem("bearer");

  return {
    escopo:
      "processo_atual",
    iniciadoEm,
    cookie,
    bearerLegado,
    totalRequisicoesAutenticadas:
      cookie.requisicoes +
      bearerLegado.requisicoes,
  };
}

function limparParaTeste() {
  iniciadoEm =
    new Date().toISOString();

  for (
    const item
    of Object.values(
      transportes
    )
  ) {
    item.requisicoes = 0;
    item.primeiraObservacaoEm =
      null;
    item.ultimaObservacaoEm =
      null;
  }
}

module.exports = {
  registrarTransporte,
  obterSnapshot,
  limparParaTeste,
};
