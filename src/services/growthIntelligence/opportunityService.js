function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(number, 0), 1);
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

function sampleConfidence(sample, minimum, strongSample) {
  if (sample < minimum) return 0;
  if (strongSample <= minimum) return 1;

  return clamp01(
    0.6 +
      ((sample - minimum) / (strongSample - minimum)) * 0.4
  );
}

function evidence(chave, rotulo, valor, unidade = null) {
  return {
    chave,
    rotulo,
    valor,
    unidade,
  };
}

function conversionOpportunity(signals) {
  if (!signals.amostra_conversao_suficiente) return null;

  const visits = signals.visitas_perfil;
  const bookings = signals.agendamentos_concluidos;
  const conversion = signals.taxa_conversao;
  const confidence = sampleConfidence(visits, 20, 100);

  if (bookings === 0) {
    return {
      codigo: "CONVERSAO_SEM_AGENDAMENTO",
      categoria: "conversao",
      titulo: "Transforme visitas em agendamentos",
      mensagem:
        `${visits} visitas ao perfil foram registradas neste período, ` +
        "mas nenhum agendamento concluído apareceu nos mesmos sinais. " +
        "Vale revisar a clareza do perfil, os serviços e a disponibilidade antes de buscar mais tráfego.",
      impacto: 1,
      confianca: confidence,
      urgencia: 0.9,
      evidencias: [
        evidence("visitas_perfil", "Visitas ao perfil", visits),
        evidence(
          "agendamentos_concluidos",
          "Agendamentos concluídos",
          bookings
        ),
        evidence("taxa_conversao", "Conversão", round(conversion, 1), "%"),
      ],
      acao: {
        tipo: "NAVEGAR",
        rotulo: "Revisar meu perfil",
        destino: "/painel/negocio",
      },
    };
  }

  if (visits < 40 || conversion > 5) return null;

  const severity = clamp01((5 - conversion) / 5);

  return {
    codigo: "CONVERSAO_BAIXA_COM_AMOSTRA",
    categoria: "conversao",
    titulo: "Revise a conversão do perfil",
    mensagem:
      `Seu perfil teve ${visits} visitas e ${bookings} agendamentos concluídos ` +
      `neste período, com conversão registrada de ${round(conversion, 1)}%. ` +
      "Isso não prova uma causa específica, mas já é amostra suficiente para revisar apresentação, serviços e horários disponíveis.",
    impacto: 0.7 + severity * 0.2,
    confianca: confidence,
    urgencia: 0.75,
    evidencias: [
      evidence("visitas_perfil", "Visitas ao perfil", visits),
      evidence(
        "agendamentos_concluidos",
        "Agendamentos concluídos",
        bookings
      ),
      evidence("taxa_conversao", "Conversão", round(conversion, 1), "%"),
    ],
    acao: {
      tipo: "NAVEGAR",
      rotulo: "Revisar meu perfil",
      destino: "/painel/negocio",
    },
  };
}

function interestWithoutBookingOpportunity(signals) {
  if (!signals.amostra_conversao_suficiente) return null;

  const interest = signals.acoes_interesse;
  const bookings = signals.agendamentos_concluidos;

  if (interest < 5) return null;
  if (interest < Math.max(5, bookings * 2)) return null;

  const confidence = sampleConfidence(interest, 5, 20);
  const interestRatio =
    signals.visitas_perfil > 0
      ? interest / signals.visitas_perfil
      : 0;

  return {
    codigo: "INTERESSE_SEM_CONCLUSAO_PROPORCIONAL",
    categoria: "conversao",
    titulo: "Há interesse antes do agendamento",
    mensagem:
      `O perfil registrou ${interest} ações de interesse ` +
      "(WhatsApp, Maps ou favoritos) para " +
      `${bookings} agendamentos concluídos no período. ` +
      "O sinal sugere que vale reduzir atrito entre interesse e reserva, sem assumir uma causa específica.",
    impacto: 0.72,
    confianca: confidence,
    urgencia: clamp01(0.6 + Math.min(interestRatio, 0.5) * 0.4),
    evidencias: [
      evidence("acoes_interesse", "Ações de interesse", interest),
      evidence(
        "agendamentos_concluidos",
        "Agendamentos concluídos",
        bookings
      ),
      evidence(
        "visitas_perfil",
        "Visitas ao perfil",
        signals.visitas_perfil
      ),
    ],
    acao: {
      tipo: "NAVEGAR",
      rotulo: "Revisar serviços",
      destino: "/painel/servicos",
    },
  };
}

function topServiceOpportunity(signals) {
  if (!signals.amostra_servicos_suficiente) return null;

  const top = signals.servico_destaque;
  const share = signals.participacao_servico_destaque;

  if (!top?.nome || top.total < 5 || share < 50) return null;

  const confidence = sampleConfidence(
    signals.agendamentos_periodo,
    8,
    30
  );

  return {
    codigo: "SERVICO_COM_TRACAO_CONCENTRADA",
    categoria: "demanda",
    titulo: "Aproveite seu serviço de maior tração",
    mensagem:
      `${top.nome} concentrou ${round(share, 1)}% dos agendamentos ` +
      "do período. Você pode destacá-lo na divulgação como porta de entrada para o perfil.",
    impacto: 0.55,
    confianca: confidence,
    urgencia: 0.5,
    evidencias: [
      evidence(
        "servico_destaque_agendamentos",
        `Agendamentos de ${top.nome}`,
        top.total
      ),
      evidence(
        "participacao_servico_destaque",
        "Participação nos agendamentos",
        round(share, 1),
        "%"
      ),
    ],
    acao: {
      tipo: "COMPARTILHAR_PERFIL",
      rotulo: "Compartilhar perfil",
    },
  };
}

const OPPORTUNITY_EVALUATORS = Object.freeze([
  conversionOpportunity,
  interestWithoutBookingOpportunity,
  topServiceOpportunity,
]);

function findGrowthOpportunities(signals) {
  return OPPORTUNITY_EVALUATORS
    .map((evaluate) => evaluate(signals))
    .filter(Boolean);
}

module.exports = {
  findGrowthOpportunities,
};
