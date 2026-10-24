const { randomUUID } = require("node:crypto");
const analyticsRepository = require("../repositories/analyticsV2Repository");

async function registrarTransicao({ negocioId, profissionalId, ativo, actorType, actorId = null, motivo = null, executor }) {
  const businessId = Number(negocioId);
  const professionalId = Number(profissionalId);
  const actorUserId = actorType === "SYSTEM" ? null : Number(actorId);
  if (!executor?.query || typeof ativo !== "boolean"
    || !Number.isSafeInteger(businessId) || businessId <= 0
    || !Number.isSafeInteger(professionalId) || professionalId <= 0
    || !["OWNER", "PROFESSIONAL", "SYSTEM"].includes(actorType)
    || (actorType !== "SYSTEM" && (!Number.isSafeInteger(actorUserId) || actorUserId <= 0))) {
    throw new TypeError("Transição da equipe exige contexto e transação válidos.");
  }

  const event = await analyticsRepository.registrarEvento({
    eventUuid: randomUUID(),
    nome: ativo ? "business_professional_reactivated" : "business_professional_deactivated",
    schemaVersion: 1,
    origem: "backend",
    occurredAt: new Date().toISOString(),
    actorUserId,
    actorBusinessId: actorType === "SYSTEM" ? null : businessId,
    targetBusinessId: businessId,
    propriedades: {
      business_id: businessId,
      professional_id: professionalId,
      actor_type: actorType,
      actor_id: actorUserId,
      ...(!ativo && motivo ? { reason: motivo } : {}),
    },
  }, executor);
  if (!event) throw new Error("Não foi possível registrar a transição da equipe.");
  return event;
}

module.exports = { registrarTransicao };
