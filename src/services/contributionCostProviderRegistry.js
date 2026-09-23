const ADAPTADORES =
  Object.freeze({});

function codigoAdaptador(
  valor
) {
  return String(
    valor || ""
  )
    .trim()
    .toLowerCase();
}

function adaptadorValido(
  adaptador
) {
  return Boolean(
    adaptador &&
    typeof adaptador === "object" &&
    typeof adaptador.coletar ===
      "function"
  );
}

function obterAdaptador(
  codigo
) {
  const adaptador =
    ADAPTADORES[
      codigoAdaptador(
        codigo
      )
    ];

  return adaptadorValido(
    adaptador
  )
    ? adaptador
    : null;
}

function listarAdaptadores() {
  return Object.entries(
    ADAPTADORES
  ).map(
    ([
      codigo,
      adaptador,
    ]) => ({
      codigo,
      nome:
        String(
          adaptador.nome ||
          codigo
        ),
      disponivel:
        adaptadorValido(
          adaptador
        ),
    })
  );
}

module.exports = {
  obterAdaptador,
  listarAdaptadores,
  codigoAdaptador,
  adaptadorValido,
};
