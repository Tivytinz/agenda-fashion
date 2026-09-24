const adminOperationRepository = require(
  "../repositories/adminOperationRepository"
);

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const USER_STATUS = new Set([
  "",
  "ativo",
  "desativado",
  "encerrado"
]);

const BUSINESS_STATUS = new Set([
  "",
  "publicado",
  "despublicado",
  "rascunho",
  "inativo",
  "arquivado"
]);

const APPOINTMENT_STATUS = new Map([
  ["", ""],
  ["agendado", "agendado"],
  ["confirmado", "confirmado"],
  ["cancelado", "cancelado"],
  ["realizado", "realizado"],
  ["concluido", "realizado"],
  ["concluído", "realizado"],
  ["falta", "falta"],
  ["nao_compareceu", "falta"],
  ["não_compareceu", "falta"]
]);

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

function list(value) {
  return Array.isArray(value)
    ? value.map((item) => text(item, 40)).filter(Boolean)
    : [];
}

function normalizeStatus(value, allowed) {
  const normalized = text(value, 40).toLocaleLowerCase("pt-BR");
  return allowed.has(normalized) ? normalized : "";
}

function normalizeAppointmentStatus(value) {
  const normalized = text(value, 40).toLocaleLowerCase("pt-BR");
  return APPOINTMENT_STATUS.get(normalized) || "";
}

function userStatus(item = {}) {
  if (item.encerrado_definitivo_em) return "encerrado";
  if (boolean(item.ativo, true)) return "ativo";
  return "desativado";
}

function user(item = {}) {
  return {
    id: number(item.id),
    nome: text(item.nome) || "Usuário sem nome",
    email: text(item.email, 180) || null,
    ativo: boolean(item.ativo, true),
    estado_operacional: userStatus(item),
    papel_admin: text(item.papel_admin, 40) || null,
    papeis_negocio: list(item.papeis_negocio),
    total_negocios_ativos: number(item.total_negocios_ativos),
    perfil_profissional_ativado_em:
      item.perfil_profissional_ativado_em || null,
    email_verificado_em:
      item.email_verificado_em || null,
    ultimo_login_em:
      item.ultimo_login_em || null,
    desativado_em:
      item.desativado_em || null,
    encerrado_definitivo_em:
      item.encerrado_definitivo_em || null,
    created_at: item.created_at || null,
    updated_at: item.updated_at || null
  };
}

function businessStatus(item = {}) {
  if (item.arquivado_em) return "arquivado";
  if (!boolean(item.ativo, true)) return "inativo";
  if (boolean(item.publicado, false)) return "publicado";
  if (item.despublicado_manual_em) return "despublicado";
  return "rascunho";
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
    publicado: boolean(item.publicado, false),
    estado_operacional: businessStatus(item),
    despublicado_manual_em:
      item.despublicado_manual_em || null,
    arquivado_em:
      item.arquivado_em || null,
    motivo_arquivamento:
      text(item.motivo_arquivamento, 80) || null,
    plano_id: item.plano_id ? number(item.plano_id) : null,
    plano_nome: text(item.plano_nome) || null,
    plano_slug: text(item.plano_slug) || null,
    dono_id: item.dono_id ? number(item.dono_id) : null,
    dono_nome: text(item.dono_nome) || null,
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
    inicio_previsto_em:
      item.inicio_previsto_em || null,
    status_atendimento_em:
      item.status_atendimento_em || null,
    status_atendimento_por:
      item.status_atendimento_por
        ? number(item.status_atendimento_por)
        : null,
    status_atendimento_por_nome:
      text(item.status_atendimento_por_nome) || null,
    cancelado_por:
      item.cancelado_por ? number(item.cancelado_por) : null,
    cancelamento_origem:
      text(item.cancelamento_origem, 40) || null,
    motivo_cancelamento:
      text(item.motivo_cancelamento, 300) || null,
    duracao_minutos: number(item.duracao_minutos),
    antecedencia_cancelamento_horas:
      number(item.antecedencia_cancelamento_horas),
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

async function listarUsuariosAdmin(query = {}) {
  const page = pagination(query);
  const busca = text(query.busca);
  const status = normalizeStatus(query.status, USER_STATUS);
  const result = await adminOperationRepository.listarUsuarios({
    busca,
    status,
    limite: page.limite,
    offset: page.offset
  });
  const total = number(result?.total);

  return {
    usuarios: Array.isArray(result?.rows)
      ? result.rows.map(user)
      : [],
    paginacao: paginationResponse({ ...page, total })
  };
}

async function listarNegociosAdmin(query = {}) {
  const page = pagination(query);
  const busca = text(query.busca);
  const status = normalizeStatus(query.status, BUSINESS_STATUS);
  const result = await adminOperationRepository.listarNegocios({
    busca,
    status,
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
  const status = normalizeAppointmentStatus(query.status);
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
  listarUsuariosAdmin,
  listarNegociosAdmin,
  listarAgendamentosAdmin
};
