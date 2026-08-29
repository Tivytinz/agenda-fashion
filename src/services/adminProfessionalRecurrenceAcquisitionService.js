const CLASSIFICACOES = new Set([
  "oficial",
  "organico",
  "rastreamento_incompleto",
  "identidade_nao_oficial",
  "sem_evidencia",
]);

const ORDEM_CLASSIFICACAO = Object.freeze({
  oficial: 0,
  organico: 1,
  rastreamento_incompleto: 2,
  identidade_nao_oficial: 3,
  sem_evidencia: 4,
});

function texto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase();
}

function normalizarAquisicao(linha = {}) {
  const classificacaoInformada =
    texto(linha.classificacao_atribuicao);
  const classificacao =
    CLASSIFICACOES.has(
      classificacaoInformada
    )
      ? classificacaoInformada
      : "sem_evidencia";

  if (classificacao === "sem_evidencia") {
    return {
      classificacao,
      origem: "sem_evidencia",
    };
  }

  const origemInformada =
    texto(linha.origem);
  let origem = origemInformada ||
    "desconhecida";

  if (
    classificacao === "organico" &&
    origem === "desconhecida"
  ) {
    origem = "organico";
  }

  return {
    classificacao,
    origem,
  };
}

function agruparPorOrigemAquisicao(
  linhas = []
) {
  const grupos = new Map();

  for (const linha of linhas) {
    const normalizada =
      normalizarAquisicao(linha);
    const chave = [
      normalizada.classificacao,
      normalizada.origem,
    ].join(":");

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        chave,
        classificacaoAtribuicao:
          normalizada.classificacao,
        origem: normalizada.origem,
        linhas: [],
      });
    }

    grupos.get(chave).linhas.push(linha);
  }

  return [...grupos.values()]
    .sort((grupoA, grupoB) => {
      const ordemA =
        ORDEM_CLASSIFICACAO[
          grupoA.classificacaoAtribuicao
        ] ?? 99;
      const ordemB =
        ORDEM_CLASSIFICACAO[
          grupoB.classificacaoAtribuicao
        ] ?? 99;

      if (ordemA !== ordemB) {
        return ordemA - ordemB;
      }

      return grupoA.origem.localeCompare(
        grupoB.origem
      );
    });
}

module.exports = {
  agruparPorOrigemAquisicao,
  normalizarAquisicao,
};
