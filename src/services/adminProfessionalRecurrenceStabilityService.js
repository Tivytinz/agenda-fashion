function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
}

function arredondar(valor) {
  if (!Number.isFinite(valor)) {
    return null;
  }

  return Number(valor.toFixed(2));
}

function criarFaixa(valores = []) {
  const validos = valores.filter(
    (valor) => Number.isFinite(valor)
  );

  if (!validos.length) {
    return {
      minimo: null,
      maximo: null,
      amplitudePp: null,
    };
  }

  const minimo = Math.min(...validos);
  const maximo = Math.max(...validos);

  return {
    minimo: arredondar(minimo),
    maximo: arredondar(maximo),
    amplitudePp: arredondar(
      maximo - minimo
    ),
  };
}

function encontrarJanela(
  coorte,
  janelaDias
) {
  const janelas = Array.isArray(
    coorte?.janelasCandidatas
  )
    ? coorte.janelasCandidatas
    : [];

  return janelas.find(
    (janela) =>
      numero(janela.janelaDias) ===
      janelaDias
  ) || null;
}

function criarDiagnosticoJanela(
  coortesSemanais,
  janelaDias
) {
  const maduras = [];
  const ordenadas = [
    ...coortesSemanais,
  ].sort((coorteA, coorteB) =>
    String(coorteB.semanaCadastro || "")
      .localeCompare(
        String(
          coorteA.semanaCadastro || ""
        )
      )
  );

  for (const coorte of ordenadas) {
    const janela = encontrarJanela(
      coorte,
      janelaDias
    );

    if (!janela || numero(janela.elegiveis) <= 0) {
      continue;
    }

    maduras.push({
      semanaCadastro:
        coorte.semanaCadastro,
      elegiveis:
        numero(janela.elegiveis),
      taxaSegundo:
        numero(
          janela.taxaSegundoNaJanela
        ),
      taxaTerceiro:
        numero(
          janela.taxaTerceiroNaJanela
        ),
    });
  }

  const maisRecente = maduras[0] || null;
  const anterior = maduras[1] || null;
  let estado = "comparacao_disponivel";

  if (maduras.length === 0) {
    estado = "sem_base_madura";
  } else if (maduras.length === 1) {
    estado = "uma_coorte_madura";
  }

  return {
    janelaDias,
    estado,
    coortesComBase: maduras.length,
    elegiveisTotal: maduras.reduce(
      (total, coorte) =>
        total + coorte.elegiveis,
      0
    ),
    faixaTaxaSegundo:
      criarFaixa(
        maduras.map(
          (coorte) => coorte.taxaSegundo
        )
      ),
    faixaTaxaTerceiro:
      criarFaixa(
        maduras.map(
          (coorte) => coorte.taxaTerceiro
        )
      ),
    variacaoRecenteSegundoPp:
      maisRecente && anterior
        ? arredondar(
          maisRecente.taxaSegundo -
          anterior.taxaSegundo
        )
        : null,
    variacaoRecenteTerceiroPp:
      maisRecente && anterior
        ? arredondar(
          maisRecente.taxaTerceiro -
          anterior.taxaTerceiro
        )
        : null,
    semanaMaisRecenteComBase:
      maisRecente?.semanaCadastro || null,
    semanaAnteriorComBase:
      anterior?.semanaCadastro || null,
  };
}

function criarDiagnosticoEstabilidade(
  coortesSemanais = [],
  janelas = [7, 14, 30]
) {
  const coortes = Array.isArray(
    coortesSemanais
  )
    ? coortesSemanais
    : [];

  return janelas.map(
    (janelaDias) =>
      criarDiagnosticoJanela(
        coortes,
        janelaDias
      )
  );
}

module.exports = {
  criarDiagnosticoEstabilidade,
  criarDiagnosticoJanela,
  criarFaixa,
};
