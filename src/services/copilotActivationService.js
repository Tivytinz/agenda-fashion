const ESTADOS_COPILOT_ATIVACAO = Object.freeze({
  GARANTIR_SERVICO_ATIVO:
    "GARANTIR_SERVICO_ATIVO",
  CONFIRMAR_AGENDA:
    "CONFIRMAR_AGENDA",
  REVISAR_PUBLICACAO:
    "REVISAR_PUBLICACAO",
  CONQUISTAR_PRIMEIRO_AGENDAMENTO:
    "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
  ATIVADO:
    "ATIVADO",
});

function acaoNavegacao(
  rotulo,
  destino
) {
  return {
    tipo: "NAVEGAR",
    rotulo,
    destino,
  };
}

function resolverCopilotAtivacao(
  ativacao = {}
) {
  const possuiServicoAtivo =
    ativacao?.possui_servico_ativo === true;
  const agendaConfigurada =
    ativacao?.agenda_configurada === true;
  const negocioPublicado =
    ativacao?.negocio_publicado === true;
  const primeiroAgendamentoRecebido =
    ativacao?.primeiro_agendamento_recebido === true;

  if (!possuiServicoAtivo) {
    return {
      estado:
        ESTADOS_COPILOT_ATIVACAO
          .GARANTIR_SERVICO_ATIVO,
      concluido: false,
      titulo: "Ative seus serviços",
      mensagem:
        "Mantenha pelo menos um serviço ativo para receber novos agendamentos.",
      acao: acaoNavegacao(
        "Gerenciar serviços",
        "/painel/servicos"
      ),
    };
  }

  if (!agendaConfigurada) {
    return {
      estado:
        ESTADOS_COPILOT_ATIVACAO
          .CONFIRMAR_AGENDA,
      concluido: false,
      titulo: "Confirme seus horários",
      mensagem:
        "Confirme quando você atende para liberar horários reais e manter os agendamentos online disponíveis.",
      acao: acaoNavegacao(
        "Confirmar horários",
        "/painel/horarios"
      ),
    };
  }

  if (!negocioPublicado) {
    return {
      estado:
        ESTADOS_COPILOT_ATIVACAO
          .REVISAR_PUBLICACAO,
      concluido: false,
      titulo: "Revise a publicação",
      mensagem:
        "Serviço e agenda estão prontos. Revise os dados obrigatórios do negócio para liberar o perfil público.",
      acao: acaoNavegacao(
        "Revisar meu negócio",
        "/painel/negocio"
      ),
    };
  }

  if (!primeiroAgendamentoRecebido) {
    return {
      estado:
        ESTADOS_COPILOT_ATIVACAO
          .CONQUISTAR_PRIMEIRO_AGENDAMENTO,
      concluido: false,
      titulo: "Divulgue seu perfil",
      mensagem:
        "Seu perfil está no ar e sua agenda está pronta. Compartilhe o link para conquistar o primeiro agendamento.",
      acao: {
        tipo: "COMPARTILHAR_PERFIL",
        rotulo: "Compartilhar perfil",
      },
    };
  }

  return {
    estado:
      ESTADOS_COPILOT_ATIVACAO
        .ATIVADO,
    concluido: true,
    titulo: "Ativação concluída",
    mensagem:
      "Seu negócio já recebeu o primeiro agendamento pelo Agenda Fashion.",
    acao: acaoNavegacao(
      "Abrir agenda",
      "/painel/agenda"
    ),
  };
}

module.exports = {
  ESTADOS_COPILOT_ATIVACAO,
  resolverCopilotAtivacao,
};
