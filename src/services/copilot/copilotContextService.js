const CHAVES_EVIDENCIA_PERMITIDAS = new Set([
  "servico_destaque_agendamentos",
  "participacao_servico_destaque",
  "visitas_perfil",
  "agendamentos_concluidos",
  "taxa_conversao",
  "acoes_interesse",
]);

function normalizarTexto(valor, limite) {
  return String(valor ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limite);
}

function normalizarNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function normalizarEvidencias(evidencias) {
  if (!Array.isArray(evidencias)) return [];

  return evidencias
    .filter((item) => CHAVES_EVIDENCIA_PERMITIDAS.has(String(item?.chave || "")))
    .slice(0, 4)
    .map((item) => ({
      chave: normalizarTexto(item.chave, 80),
      rotulo: normalizarTexto(item.rotulo, 120),
      valor: normalizarNumero(item.valor),
      unidade: item.unidade ? normalizarTexto(item.unidade, 12) : null,
    }));
}

function buildCopilotShareContext({ dashboard = {}, oportunidade = {} } = {}) {
  const servicoDestaque = Array.isArray(dashboard.ranking_servicos)
    ? dashboard.ranking_servicos[0]
    : null;

  return {
    finalidade: "divulgacao_perfil",
    canal: "whatsapp",
    periodo: normalizarTexto(dashboard.periodo || "7dias", 20),
    negocio: {
      nome: normalizarTexto(dashboard.negocio?.nome || "", 120),
    },
    oportunidade: {
      codigo: normalizarTexto(oportunidade.codigo, 80),
      categoria: normalizarTexto(oportunidade.categoria, 60),
      titulo: normalizarTexto(oportunidade.titulo, 140),
      evidencias: normalizarEvidencias(oportunidade.evidencias),
    },
    servico_destaque: servicoDestaque?.nome
      ? {
          nome: normalizarTexto(servicoDestaque.nome, 120),
          agendamentos: normalizarNumero(servicoDestaque.total),
        }
      : null,
  };
}

module.exports = {
  buildCopilotShareContext,
};
