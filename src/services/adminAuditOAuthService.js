const AppError = require("../errors/AppError");
const sessaoRepository = require("../repositories/sessaoRepository");
const audit = require("./adminAuditService");
const registrador = require("../utils/registrador");

async function recordResult(started, status) {
  try {
    await audit.finish(started, { status });
  } catch (error) {
    registrador.erro("Resultado da auditoria OAuth pendente.", {
      tentativa_id: started.tentativaId,
      acao: started.acao,
      codigo: error?.code || "audit_result_failed"
    });
  }
}

async function run({ userId, action, execute }) {
  const admin = await sessaoRepository.buscarAdministradorAtivoPorUsuarioId(userId);
  if (!admin) {
    throw new AppError("Autorização administrativa revogada.", 403);
  }
  const started = await audit.start({
    admin: { usuarioId: userId, papel: admin.papel },
    action
  });
  try {
    const result = await execute();
    await recordResult(started, 200);
    return result;
  } catch (error) {
    await recordResult(started, error?.statusCode || 500);
    throw error;
  }
}

module.exports = { run };
