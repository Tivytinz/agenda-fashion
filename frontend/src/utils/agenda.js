export function getAgendaEntityName(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  return typeof value.nome === "string" ? value.nome.trim() : "";
}

export function getValidAgendaDays(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((day) => day && typeof day === "object" && day.data);
}

export function getValidProfessionals(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((professional) => (
    professional
    && typeof professional === "object"
    && professional.id != null
  ));
}

export function getValidSlots(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((slot) => (
    slot
    && typeof slot === "object"
    && slot.hora
  ));
}
