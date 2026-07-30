const ORIGENS_PADRAO = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "https://app.agendafashion.com.br",
];

function obterOrigensPermitidas() {
  const configuradas =
    String(
      process.env.CORS_ORIGINS ||
      ""
    )
      .split(",")
      .map(
        (origem) =>
          origem.trim()
      )
      .filter(Boolean);

  return new Set(
    configuradas.length
      ? configuradas
      : ORIGENS_PADRAO
  );
}

const origensPermitidas =
  obterOrigensPermitidas();

function validarOrigem(
  origem,
  callback
) {
  if (
    !origem ||
    origensPermitidas.has(
      origem
    )
  ) {
    return callback(
      null,
      true
    );
  }

  const erro =
    new Error(
      "Origem nao permitida pelo CORS."
    );

  erro.statusCode =
    403;

  return callback(
    erro
  );
}

const corsOptions = {
  origin:
    validarOrigem,
  methods: [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "OPTIONS",
  ],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Idempotency-Key",
    "X-Request-ID",
  ],
  exposedHeaders: [
    "X-Request-ID",
  ],
  maxAge:
    86400,
};

module.exports = {
  corsOptions,
  obterOrigensPermitidas,
  validarOrigem,
};