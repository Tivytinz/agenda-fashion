const repository = require(
  "../repositories/contributionEconomicsRepository"
);

const TIPOS = new Set([
  "DEBITO",
  "CREDITO",
]);

const STATUS_COBERTURA = new Set([
  "COMPLETA",
  "INCOMPLETA",
]);

function textoObrigatorio(
  valor,
  nome,
  limite = 160
) {
  const texto = String(
    valor || ""
  ).trim();

  if (
    !texto ||
    texto.length > limite
  ) {
    throw new Error(
      `${nome} invalido`
    );
  }

  return texto;
}

function inteiroPositivo(
  valor,
  nome
) {
  const numero = Number(valor);

  if (
    !Number.isInteger(numero) ||
    numero <= 0
  ) {
    throw new Error(
      `${nome} invalido`
    );
  }

  return numero;
}

function valorMonetario(
  valor
) {
  const numero = Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero < 0
  ) {
    throw new Error(
      "valor invalido"
    );
  }

  return Number(
    numero.toFixed(2)
  );
}

function instante(
  valor,
  nome
) {
  const data = new Date(valor);

  if (
    !valor ||
    Number.isNaN(data.getTime())
  ) {
    throw new Error(
      `${nome} invalido`
    );
  }

  return data.toISOString();
}

function dataIso(
  valor,
  nome
) {
  const texto = textoObrigatorio(
    valor,
    nome,
    10
  );

  if (
    !/^\d{4}-\d{2}-\d{2}$/
      .test(texto)
  ) {
    throw new Error(
      `${nome} invalido`
    );
  }

  return texto;
}

function mesmoInstante(
  a,
  b
) {
  return new Date(a).getTime() ===
    new Date(b).getTime();
}

function mesmoCusto(
  registro,
  esperado
) {
  return (
    Number(registro.negocio_id) ===
      esperado.negocioId &&
    registro.chave_origem ===
      esperado.chaveOrigem &&
    registro.tipo ===
      esperado.tipo &&
    Number(registro.valor) ===
      esperado.valor &&
    mesmoInstante(
      registro.ocorrido_em,
      esperado.ocorridoEm
    ) &&
    Number(
      registro.custo_referenciado_id ||
      0
    ) ===
      Number(
        esperado.custoReferenciadoId ||
        0
      )
  );
}

async function registrarCustoObservado({
  fonteCodigo,
  negocioId,
  chaveOrigem,
  tipo,
  valor,
  ocorridoEm,
  custoReferenciadoId = null,
  detalhes = {},
}) {
  const normalizado = {
    fonteCodigo:
      textoObrigatorio(
        fonteCodigo,
        "fonteCodigo",
        80
      ),
    negocioId:
      inteiroPositivo(
        negocioId,
        "negocioId"
      ),
    chaveOrigem:
      textoObrigatorio(
        chaveOrigem,
        "chaveOrigem"
      ),
    tipo:
      textoObrigatorio(
        tipo,
        "tipo",
        20
      ).toUpperCase(),
    valor:
      valorMonetario(valor),
    ocorridoEm:
      instante(
        ocorridoEm,
        "ocorridoEm"
      ),
    custoReferenciadoId:
      custoReferenciadoId == null
        ? null
        : inteiroPositivo(
            custoReferenciadoId,
            "custoReferenciadoId"
          ),
    detalhes:
      detalhes &&
      typeof detalhes === "object" &&
      !Array.isArray(detalhes)
        ? detalhes
        : {},
  };

  if (
    !TIPOS.has(
      normalizado.tipo
    )
  ) {
    throw new Error(
      "tipo invalido"
    );
  }

  const resultado =
    await repository.persistirCusto(
      normalizado
    );

  if (resultado.fonteAusente) {
    throw new Error(
      "fonte de contribuicao inexistente ou inativa"
    );
  }

  if (!resultado.registro) {
    throw new Error(
      "nao foi possivel persistir custo de contribuicao"
    );
  }

  if (
    !resultado.criado &&
    !mesmoCusto(
      resultado.registro,
      normalizado
    )
  ) {
    throw new Error(
      "replay conflitante de custo de contribuicao"
    );
  }

  return {
    ...resultado.registro,
    replay: !resultado.criado,
  };
}

async function registrarCoberturaFonte({
  fonteCodigo,
  inicioCobertura,
  cobertoAte,
  status,
}) {
  const normalizado = {
    fonteCodigo:
      textoObrigatorio(
        fonteCodigo,
        "fonteCodigo",
        80
      ),
    inicioCobertura:
      dataIso(
        inicioCobertura,
        "inicioCobertura"
      ),
    cobertoAte:
      cobertoAte == null
        ? null
        : dataIso(
            cobertoAte,
            "cobertoAte"
          ),
    status:
      textoObrigatorio(
        status,
        "status",
        20
      ).toUpperCase(),
  };

  if (
    !STATUS_COBERTURA.has(
      normalizado.status
    )
  ) {
    throw new Error(
      "status de cobertura invalido"
    );
  }

  if (
    normalizado.cobertoAte &&
    normalizado.cobertoAte <
      normalizado.inicioCobertura
  ) {
    throw new Error(
      "intervalo de cobertura invalido"
    );
  }

  const resultado =
    await repository
      .persistirCobertura(
        normalizado
      );

  if (resultado.fonteAusente) {
    throw new Error(
      "fonte de contribuicao inexistente ou inativa"
    );
  }

  if (!resultado.registro) {
    throw new Error(
      "cobertura regressiva ou inconsistente"
    );
  }

  return resultado.registro;
}

module.exports = {
  registrarCustoObservado,
  registrarCoberturaFonte,
};
