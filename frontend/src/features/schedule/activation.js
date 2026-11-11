// Interpreta o retorno canônico; não decide publicação ou autorização no browser.
export function scheduleActivationContext(dashboard) {
  const activationState = dashboard?.proxima_acao_ativacao?.estado ?? null;
  const hasBookableAvailability = dashboard?.ativacao?.possui_disponibilidade_agendavel !== false;
  const canShare = activationState === "CONQUISTAR_PRIMEIRO_AGENDAMENTO" && hasBookableAvailability;
  const business = dashboard?.negocio || {};
  return {
    activationState,
    canShare,
    guidance: dashboard?.proxima_acao_ativacao,
    businessContext: canShare && business.slug ? {
      id: business.negocio_id ?? business.id,
      name: business.nome || "Seu negócio",
      slug: business.slug
    } : null
  };
}
