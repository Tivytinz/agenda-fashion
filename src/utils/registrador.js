const NIVEIS = {
  silencioso: 0,
  erro: 1,
  aviso: 2,
  informacao: 3,
};

const APELIDOS_NIVEL = {
  silent: "silencioso",
  error: "erro",
  warn: "aviso",
  warning: "aviso",
  info: "informacao",
};

function obterNivelConfigurado() {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.DEBUG_TEST_LOGS !== "true"
  ) {
    return "silencioso";
  }

  const nivelPadrao =
    process.env.NODE_ENV === "production"
      ? "informacao"
      : "aviso";

  const nivelInformado = String(
    process.env.LOG_LEVEL || nivelPadrao
  )
    .trim()
    .toLowerCase();

  const nivel =
    APELIDOS_NIVEL[nivelInformado] ||
    nivelInformado;

  return Object.hasOwn(NIVEIS, nivel)
    ? nivel
    : nivelPadrao;
}

function deveRegistrar(nivel) {
  return (
    NIVEIS[obterNivelConfigurado()] >=
    NIVEIS[nivel]
  );
}

function escrever(metodo, nivel, mensagem, contexto) {
  if (!deveRegistrar(nivel)) {
    return;
  }

  const prefixo = {
    erro: "[ERRO]",
    aviso: "[AVISO]",
    informacao: "[INFORMAÇÃO]",
  }[nivel];

  if (contexto === undefined) {
    console[metodo](`${prefixo} ${mensagem}`);
    return;
  }

  console[metodo](`${prefixo} ${mensagem}`, contexto);
}

module.exports = {
  erro(mensagem, contexto) {
    escrever("error", "erro", mensagem, contexto);
  },

  aviso(mensagem, contexto) {
    escrever("warn", "aviso", mensagem, contexto);
  },

  informacao(mensagem, contexto) {
    escrever("info", "informacao", mensagem, contexto);
  },
};
