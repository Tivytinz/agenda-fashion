const AppError = require("../errors/AppError");
const audit = require("../services/adminAuditService");
const registrador = require("../utils/registrador");

function resultTargetId(type, payload) {
  const names = {
    campanha: ["campanha", "vinculo"],
    gasto: ["gasto"],
    fonte: ["fonte", "cobertura"],
    custo: ["custo"],
    integracao: ["integracao"]
  }[type] || [];
  for (const name of names) {
    const item = payload?.[name];
    const id = Number(name === "vinculo"
      ? item?.campanhaId || item?.campanha_id
      : item?.id || item?.fonteId || item?.campanhaId);
    if (Number.isSafeInteger(id) && id > 0) return id;
  }
  return null;
}

function adminAudit(action) {
  if (!audit.ACTIONS.has(action)) throw new TypeError("Ação administrativa sem contrato de auditoria.");

  return async function auditRequest(req, res, next) {
    let started;
    try {
      started = await audit.start({
        admin: req.admin,
        action,
        targetId: req.params?.id,
        targetCode: req.params?.provedor,
        targetAttemptId: action === "auditoria_revisar" ? req.params?.id : undefined,
        requestId: req.id
      });
    } catch (error) {
      registrador.erro("Auditoria administrativa indisponível antes da ação.", {
        acao: action,
        codigo: error?.code || "audit_start_failed"
      });
      return next(error instanceof AppError ? error : new AppError(
        "Ação indisponível: não foi possível registrar a auditoria.", 503
      ));
    }

    let targetId = null;
    const sendJson = res.json.bind(res);
    res.json = (payload) => {
      if (res.statusCode < 400) {
        targetId = resultTargetId(started.alvoTipo, payload);
      }
      return sendJson(payload);
    };

    res.once("finish", () => {
      audit.finish(started, {
        targetId,
        status: res.statusCode
      }).catch((error) => {
        // The INICIADA event remains visible for investigation. Never log
        // the request body, query, provider credentials or response payload.
        registrador.erro("Resultado da auditoria administrativa pendente.", {
          tentativa_id: started.tentativaId,
          acao: action,
          codigo: error?.code || "audit_result_failed"
        });
      });
    });
    return next();
  };
}

module.exports = adminAudit;
