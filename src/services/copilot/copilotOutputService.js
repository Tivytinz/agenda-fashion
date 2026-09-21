const URL_PATTERN = /(?:https?:\/\/|www\.)/i;
const EMAIL_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN =
  /(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}\b/;

const CLAIM_PATTERNS = Object.freeze([
  /\bR\$\s*\d/i,
  /\bBRL\b/i,
  /\b\d+(?:[.,]\d+)?\s*%/i,
  /\b(?:desconto|promo[cç][aã]o|promocional|cupom|oferta|gr[aá]tis|gratuito)\b/i,
  /(?:[uú]ltimas?\s+vagas?|poucas?\s+vagas?|vagas?\s+dispon[ií]veis?|hor[aá]rios?\s+dispon[ií]veis?|agenda\s+aberta|disponibilidade\s+imediata)\b/i,
  /\b(?:resultado\s+garantido|garantia\s+de\s+resultado)\b/i,
]);

function normalizarTexto(valor, limite) {
  return String(valor ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limite);
}

function possuiAlegacaoNaoAutorizada(conteudo) {
  return CLAIM_PATTERNS.some((padrao) => padrao.test(conteudo));
}

function sanitizeCopilotShareOutput(saida) {
  if (!saida || typeof saida !== "object" || Array.isArray(saida)) {
    return null;
  }

  const titulo = normalizarTexto(saida.titulo, 80);
  const texto = normalizarTexto(saida.texto, 600);
  const conteudo = `${titulo}\n${texto}`;

  if (
    !titulo ||
    texto.length < 20 ||
    URL_PATTERN.test(conteudo) ||
    EMAIL_PATTERN.test(conteudo) ||
    PHONE_PATTERN.test(conteudo) ||
    possuiAlegacaoNaoAutorizada(conteudo)
  ) {
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
  possuiAlegacaoNaoAutorizada,
};
