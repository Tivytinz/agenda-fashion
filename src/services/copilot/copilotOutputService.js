const URL_PATTERN = /(?:https?:\/\/|www\.)/i;

function normalizarTexto(valor, limite) {
  return String(valor ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limite);
}

function sanitizeCopilotShareOutput(saida) {
  if (!saida || typeof saida !== "object" || Array.isArray(saida)) {
    return null;
  }

  const titulo = normalizarTexto(saida.titulo, 80);
  const texto = normalizarTexto(saida.texto, 600);

  if (!titulo || texto.length < 20 || URL_PATTERN.test(texto)) {
    return null;
  }

  return { titulo, texto };
}

function buildFallbackShareOutput(contexto = {}) {
  const negocio = normalizarTexto(contexto.negocio?.nome, 120) || "este negócio";
  const servico = normalizarTexto(contexto.servico_destaque?.nome, 120);

  if (servico) {
    return {
      titulo: `${servico} em destaque`,
      texto:
        `💅 ${servico} está em destaque no ${negocio}. ` +
        "Veja nossos serviços no Agenda Fashion e escolha o melhor horário para você.",
    };
  }

  return {
    titulo: `${negocio} no Agenda Fashion`,
    texto:
      `Conheça ${negocio} no Agenda Fashion. ` +
      "Veja os serviços disponíveis e escolha o melhor horário para você.",
  };
}

module.exports = {
  sanitizeCopilotShareOutput,
  buildFallbackShareOutput,
};
