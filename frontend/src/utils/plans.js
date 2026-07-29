function pluralize(value, singular, plural) {
  return `${value} ${Number(value) === 1 ? singular : plural}`;
}

export function planFeatures(plan) {
  const capacity = plan.capacidade_agendamentos == null
    ? "Agendamentos ilimitados"
    : `${pluralize(plan.capacidade_agendamentos, "agendamento", "agendamentos")}/mês`;
  const professionals = plan.limite_profissionais == null
    ? "Profissionais ilimitados"
    : pluralize(plan.limite_profissionais, "profissional", "profissionais");
  const services = plan.limite_servicos == null
    ? "Serviços ilimitados"
    : pluralize(plan.limite_servicos, "serviço", "serviços");

  return [capacity, professionals, services, "WhatsApp Business incluído"];
}
