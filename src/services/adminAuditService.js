const crypto = require("crypto");
const AppError = require("../errors/AppError");
const repository = require("../repositories/adminAuditRepository");

const ACTIONS = new Map([
  ["campanha_criar", "campanha"],
  ["campanha_atualizar", "campanha"],
  ["gasto_registrar", "gasto"],
  ["contribuicao_fonte_criar", "fonte"],
  ["contribuicao_custo_registrar", "custo"],
  ["contribuicao_cobertura_registrar", "fonte"],
  ["contribuicao_integracao_criar", "integracao"],
  ["contribuicao_integracao_atualizar", "integracao"],
  ["contribuicao_sincronizar", "integracao"],
  ["tiktok_oauth_iniciar", "integracao"],
  ["pinterest_oauth_iniciar", "integracao"],
  ["tiktok_oauth_concluir", "integracao"],
  ["pinterest_oauth_concluir", "integracao"],
  ["midia_vincular", "campanha"],
  ["midia_sincronizar", "integracao"]
]);
const PROVIDERS = new Set(["google_ads", "meta_ads", "pinterest_ads", "tiktok_ads"]);

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function actor(admin) {
  const id = positiveId(admin?.usuarioId);
  const role = admin?.papel;
  if (!id || !["admin", "superadmin"].includes(role)) {
    throw new AppError("Permissão administrativa inválida.", 403);
  }
  return { id, role };
}

function definition(action) {
  const target = ACTIONS.get(action);
  if (!target) throw new TypeError("Ação administrativa não mapeada.");
  return target;
}

async function start({ admin, action, targetId, targetCode, requestId }) {
  const { id, role } = actor(admin);
  const target = definition(action);
  const attemptId = crypto.randomUUID();
  const event = {
    tentativaId: attemptId,
    fase: "INICIADA",
    atorUsuarioId: id,
    papelAdmin: role,
    acao: action,
    alvoTipo: target,
    alvoId: positiveId(targetId),
    alvoCodigo: PROVIDERS.has(targetCode) ? targetCode : (
      action.startsWith("tiktok_oauth_") ? "tiktok_ads" :
        action.startsWith("pinterest_oauth_") ? "pinterest_ads" : null
    ),
    // The inbound X-Request-ID may be supplied by a client. Store only a
    // deterministic digest so it cannot be used to inject personal data.
    requestId: /^[a-zA-Z0-9._:-]{8,100}$/.test(String(requestId || ""))
      ? crypto.createHash("sha256").update(requestId).digest("hex") : null
  };
  await repository.registrarEvento(event);
  return event;
}

async function finish(started, { targetId, status }) {
  const httpStatus = Number(status);
  if (!Number.isInteger(httpStatus) || httpStatus < 100 || httpStatus > 599) {
    throw new TypeError("Status da auditoria inválido.");
  }
  return repository.registrarEvento({
    ...started,
    fase: "RESULTADO",
    alvoId: positiveId(targetId) || started.alvoId,
    resultado: httpStatus < 400 ? "HTTP_OK" : "HTTP_ERRO",
    httpStatus
  });
}

async function list({ admin, query = {} }) {
  if (actor(admin).role !== "superadmin") {
    throw new AppError("Auditoria restrita ao superadministrador.", 403);
  }
  const page = positiveId(query.pagina) || 1;
  if (page > 1000000) throw new AppError("Página inválida.", 400);
  const limit = Math.min(positiveId(query.limite) || 25, 100);
  const action = String(query.acao || "").trim();
  if (action && !ACTIONS.has(action)) throw new AppError("Ação inválida.", 400);
  const targetType = String(query.alvoTipo || "").trim();
  if (targetType && ![...ACTIONS.values()].includes(targetType)) {
    throw new AppError("Tipo de alvo inválido.", 400);
  }
  const result = String(query.resultado || "").trim();
  if (result && !["PENDENTE", "HTTP_OK", "HTTP_ERRO"].includes(result)) {
    throw new AppError("Resultado de auditoria inválido.", 400);
  }
  for (const name of ["atorId", "alvoId"]) {
    if (query[name] && !positiveId(query[name])) {
      throw new AppError("Identificador de auditoria inválido.", 400);
    }
  }
  const { rows, total } = await repository.listar({
    atorId: positiveId(query.atorId),
    acao: action,
    alvoTipo: targetType,
    alvoId: positiveId(query.alvoId),
    resultado: result,
    limite: limit,
    offset: (page - 1) * limit
  });
  return {
    acoes: [...ACTIONS.keys()],
    eventos: rows.map((row) => ({
      tentativaId: row.tentativa_id,
      atorUsuarioId: Number(row.ator_usuario_id),
      papelAdmin: row.papel_admin,
      acao: row.acao,
      alvoTipo: row.alvo_tipo,
      alvoId: row.alvo_id ? Number(row.alvo_id) : null,
      alvoCodigo: row.alvo_codigo || null,
      requestId: row.request_id,
      iniciadoEm: row.iniciado_em,
      finalizadoEm: row.finalizado_em,
      resultado: row.resultado || "PENDENTE",
      httpStatus: row.http_status || null
    })),
    paginacao: {
      pagina: page, limite: limit, total,
      totalPaginas: total ? Math.ceil(total / limit) : 0
    }
  };
}

module.exports = { ACTIONS, start, finish, list };
