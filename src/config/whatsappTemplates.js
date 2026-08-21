const CONFIGURACOES_TEMPLATE = Object.freeze({
  NOVO_AGENDAMENTO_PROFISSIONAL: Object.freeze({
    rotulo: "Novo agendamento para o profissional",
    destinatario: "Profissional",
    categoria: "UTILITY",
    variavel: "WHATSAPP_TEMPLATE_NOVO_AGENDAMENTO",
    padrao: "novo_agendamento",
  }),

  CONFIRMACAO_AGENDAMENTO_CLIENTE: Object.freeze({
    rotulo: "Confirmação para a cliente",
    destinatario: "Cliente",
    categoria: "UTILITY",
    variavel: "WHATSAPP_TEMPLATE_CONFIRMACAO_CLIENTE",
    padrao: "confirmacao_agendamento_cliente",
  }),

  LEMBRETE_AGENDAMENTO_CLIENTE: Object.freeze({
    rotulo: "Lembrete para a cliente",
    destinatario: "Cliente",
    categoria: "UTILITY",
    variavel: "WHATSAPP_TEMPLATE_LEMBRETE_CLIENTE",
    padrao: "lembrete_agendamento",
  }),

  LEMBRETE_AGENDAMENTO_PROFISSIONAL: Object.freeze({
    rotulo: "Lembrete para o profissional",
    destinatario: "Profissional",
    categoria: "UTILITY",
    variavel: "WHATSAPP_TEMPLATE_LEMBRETE_PROFISSIONAL",
    padrao: "lembrete_agendamento_profissional",
    variavelAtivacao: "WHATSAPP_PROFESSIONAL_REMINDER_ENABLED",
  }),

  CANCELAMENTO_AGENDAMENTO_PROFISSIONAL: Object.freeze({
    rotulo: "Cancelamento para o profissional",
    destinatario: "Profissional",
    categoria: "UTILITY",
    variavel: "WHATSAPP_TEMPLATE_CANCELAMENTO_PROFISSIONAL",
    padrao: "cancelamento_agendamento_profissional",
  }),

  CANCELAMENTO_AGENDAMENTO_CLIENTE: Object.freeze({
    rotulo: "Cancelamento para a cliente",
    destinatario: "Cliente",
    categoria: "UTILITY",
    variavel: "WHATSAPP_TEMPLATE_CANCELAMENTO_CLIENTE",
    padrao: "cancelamento_agendamento",
  }),

  LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO: Object.freeze({
    rotulo: "Ativação do primeiro serviço",
    destinatario: "Dono do negócio",
    categoria: "MARKETING",
    variavel: "WHATSAPP_TEMPLATE_PRIMEIRO_SERVICO",
    padrao: "lembrete_primeiro_servico",
    variavelAtivacao: "WHATSAPP_FIRST_SERVICE_REMINDER_ENABLED",
  }),

  LEMBRETE_DIVULGAR_NEGOCIO: Object.freeze({
    rotulo: "Divulgação do negócio",
    destinatario: "Dono do negócio",
    categoria: "MARKETING",
    variavel: "WHATSAPP_TEMPLATE_DIVULGAR_NEGOCIO",
    padrao: "lembrete_divulgar_negocio",
    variavelAtivacao: "WHATSAPP_SHARE_REMINDER_ENABLED",
  }),
});

function configuracaoBooleana(
  valor,
  valorPadrao = false
) {
  if (
    valor === undefined ||
    valor === null ||
    String(valor).trim() === ""
  ) {
    return valorPadrao;
  }

  return [
    "1",
    "true",
    "sim",
    "yes",
  ].includes(
    String(valor)
      .trim()
      .toLowerCase()
  );
}

function obterNomeTemplate(
  tipo,
  ambiente = process.env
) {
  const configuracao =
    CONFIGURACOES_TEMPLATE[tipo];

  if (!configuracao) {
    const erro = new Error(
      `Tipo de mensagem do WhatsApp não suportado: ${tipo}.`
    );

    erro.code =
      "WHATSAPP_MESSAGE_TYPE_UNSUPPORTED";

    throw erro;
  }

  return String(
    ambiente[configuracao.variavel] ||
    configuracao.padrao
  ).trim();
}

function listarTemplatesConfigurados(
  ambiente = process.env
) {
  const notificacoesAtivas =
    configuracaoBooleana(
      ambiente.WHATSAPP_NOTIFICATIONS_ENABLED,
      false
    );

  return Object.entries(
    CONFIGURACOES_TEMPLATE
  ).map(
    ([tipo, configuracao]) => {
      const rotinaAtiva =
        !configuracao.variavelAtivacao ||
        configuracaoBooleana(
          ambiente[configuracao.variavelAtivacao],
          false
        );

      return {
        tipo,
        rotulo: configuracao.rotulo,
        destinatario: configuracao.destinatario,
        categoriaEsperada: configuracao.categoria,
        nome: obterNomeTemplate(
          tipo,
          ambiente
        ),
        idioma: String(
          ambiente.WHATSAPP_TEMPLATE_LANGUAGE ||
          "pt_BR"
        ).trim(),
        automacaoHabilitada:
          notificacoesAtivas &&
          rotinaAtiva,
        variavelAtivacao:
          configuracao.variavelAtivacao ||
          "WHATSAPP_NOTIFICATIONS_ENABLED",
      };
    }
  );
}

module.exports = {
  CONFIGURACOES_TEMPLATE,
  configuracaoBooleana,
  listarTemplatesConfigurados,
  obterNomeTemplate,
};
