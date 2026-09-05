const adminOperationRepository = require(
  "../repositories/adminOperationRepository"
);

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function integer(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pagination(query = {}) {
  const pagina = integer(query.pagina, 1);
  const limite = Math.min(integer(query.limite, DEFAULT_LIMIT), MAX_LIMIT);
  return {
    pagina,
    limite,
    offset: (pagina - 1) * limite
  };
}

function text(value, maxLength = 120) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, maxLength) : "";
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boolean(value, fallback = true) {
  if ([true, "true", 1, "1"].includes(value)) return true;
  if ([false, "false", 0, "0"].includes(value)) return false;
  return fallback;
}

function business(item = {}) {
  const whatsapp = text(item.whatsapp || item.whatsapp_negocio) || null;

  return {
    id: number(item.id),
    nome: text(item.nome) || "Negócio sem nome",
    slug: text(item.slug) || null,
    cidade: text(item.cidade) || null,
    bairro: text(item.bairro) || null,
    setor: text(item.setor) || null,
    whatsapp,
    // Alias legado preservado para consumidores administrativos antigos.
    whatsapp_negocio: whatsapp,
    foto_url: text(item.foto_url, 500) || null,
    ativo: boolean(item.ativo, true),
    total_profissionais: number(item.total_profissionais),
    total_servicos: number(item.total_servicos),
    total_agendamentos: number(item.total_agendamentos),
    created_at: item.created_at || null,
    updated_at: item.updated_at || null
  };
}

function appointment(item = {}) {
  return {
    id: number(item.id),
    data: item.data || null,
    horario: item.horario || null,
    status: text(item.status, 40) || "agendado",
    cliente_id: item.cliente_id ? number(item.cliente_id) : null,
    cliente_nome: text(item.cliente_nome) || "Cliente não informado",
    negocio_id: item.negocio_id ? number(item.negocio_id) : null,
    negocio: text(item.negocio) || "Negócio não informado",
    servico_id: item.servico_id ? number(item.servico_id) : null,
    servico: text(item.servico) || "Serviço não informado",
    valor: number(item.valor),
    profissional_id: item.profissional_id ? number(item.profissional_id) : null,
    profissional: text(item.profissional) || "Profissional não informado",
    created_at: item.created_at || null
  };
}

function paginationResponse({ pagina, limite, total }) {
  return {
    pagina,
    limite,
    total,
    totalPaginas: total > 0 ? Math.ceil(total / limite) : 0
  };
}

async function listarNegociosAdmin(query = {}) {
  const page = pagination(query);
  const busca = text(query.busca);
  const result = await adminOperationRepository.listarNegocios({
    busca,
    limite: page.limite,
    offset: page.offset
  });
  const total = number(result?.total);

  return {
    negocios: Array.isArray(result?.rows) ? result.rows.map(business) : [],
    paginacao: paginationResponse({ ...page, total })
  };
}

async function listarAgendamentosAdmin(query = {}) {
  const page = pagination(query);
  const busca = text(query.busca);
  const status = text(query.status, 40);
  const result = await adminOperationRepository.listarAgendamentos({
    busca,
    status,
    limite: page.limite,
    offset: page.offset
  });
  const total = number(result?.total);

  return {
    agendamentos: Array.isArray(result?.rows) ? result.rows.map(appointment) : [],
    paginacao: paginationResponse({ ...page, total })
  };
}

module.exports = {
  listarNegociosAdmin,
  listarAgendamentosAdmin
};
