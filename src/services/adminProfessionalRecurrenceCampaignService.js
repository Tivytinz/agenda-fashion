const METODOS_RESOLUCAO = Object.freeze([
  "utm_exata",
  "vinculo_plataforma",
  "vinculo_unico",
]);

const ORDEM_METODO = new Map(
  METODOS_RESOLUCAO.map(
    (metodo, indice) => [metodo, indice]
  )
);

function texto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase();
}

function normalizarCampanhaOficial(linha = {}) {
  if (
    texto(linha.classificacao_atribuicao) !==
    "oficial"
  ) {
    return null;
  }

  const campanhaOficialId = String(
    linha.campanha_oficial_id || ""
  ).trim();

  if (!campanhaOficialId) {
    return null;
  }

  const origem = texto(linha.origem) ||
    "desconhecida";
  const midia = texto(linha.midia) ||
    "desconhecida";
  const campanha = String(
    linha.campanha || ""
  ).trim();
  const metodoResolucao = texto(
    linha.metodo_resolucao
  );

  return {
    campanhaOficialId,
    origem,
    midia,
    campanha,
    metodoResolucao:
      ORDEM_METODO.has(metodoResolucao)
        ? metodoResolucao
        : null,
  };
}

function agruparPorCampanhaOficial(
  linhas = []
) {
  const grupos = new Map();

  for (const linha of linhas) {
    const normalizada =
      normalizarCampanhaOficial(linha);

    if (!normalizada) {
      continue;
    }

    const chave =
      `campanha:${normalizada.campanhaOficialId}`;

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        chave,
        campanhaOficialId:
          normalizada.campanhaOficialId,
        origem: normalizada.origem,
        midia: normalizada.midia,
        campanha: normalizada.campanha,
        metodosResolucao: new Set(),
        linhas: [],
      });
    }

    const grupo = grupos.get(chave);
    grupo.linhas.push(linha);

    if (normalizada.metodoResolucao) {
      grupo.metodosResolucao.add(
        normalizada.metodoResolucao
      );
    }
  }

  return [...grupos.values()]
    .map((grupo) => ({
      ...grupo,
      metodosResolucao: [
        ...grupo.metodosResolucao,
      ].sort((metodoA, metodoB) =>
        (
          ORDEM_METODO.get(metodoA) ?? 99
        ) - (
          ORDEM_METODO.get(metodoB) ?? 99
        )
      ),
    }))
    .sort((grupoA, grupoB) => {
      const origem =
        grupoA.origem.localeCompare(
          grupoB.origem
        );

      if (origem !== 0) {
        return origem;
      }

      const campanha =
        grupoA.campanha.localeCompare(
          grupoB.campanha
        );

      if (campanha !== 0) {
        return campanha;
      }

      return grupoA.campanhaOficialId
        .localeCompare(
          grupoB.campanhaOficialId,
          "pt-BR",
          { numeric: true }
        );
    });
}

module.exports = {
  agruparPorCampanhaOficial,
  normalizarCampanhaOficial,
};
