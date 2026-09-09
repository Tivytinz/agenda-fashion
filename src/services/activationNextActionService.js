const ESTADOS_PROXIMA_ACAO_ATIVACAO = Object.freeze({
  GARANTIR_SERVICO_ATIVO: "GARANTIR_SERVICO_ATIVO",
  REVISAR_PUBLICACAO: "REVISAR_PUBLICACAO",
  CONQUISTAR_PRIMEIRO_AGENDAMENTO: "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
  ATIVADO: "ATIVADO",
});

function acaoNavegacao(rotulo, destino) {
  return {
    tipo: "NAVEGAR",
    rotulo,
    destino,
  };
}

function resolverProximaAcaoAtivacao(ativacao = {}) {
  const possuiServico = ativacao?.possui_servico === true;
  const possuiServicoAtivo = ativacao?.possui_servico_ativo === true;
  const negocioPublicado = ativacao?.negocio_publicado === true;
  const primeiroAgendamentoRecebido =
    ativacao?.primeiro_agendamento_recebido === true;

  if (!possuiServicoAtivo) {
    const primeiraInclusao = !possuiServico;

    return {
      estado: ESTADOS_PROXIMA_ACAO_ATIVACAO.GARANTIR_SERVICO_ATIVO,
      concluido: false,
      titulo: "Cadastre seu primeiro serviço",
      mensagem:
        "Adicione pelo menos um serviço ativo para publicar seu perfil e começar a receber agendamentos.",
      acao: acaoNavegacao(
        primeiraInclusao
          ? "Cadastrar primeiro serviço"
          : "Gerenciar serviços",
        primeiraInclusao
          ? "/painel/servicos/novo?onboarding=servico"
          : "/painel/servicos"
      ),
    };
  }

  if (!negocioPublicado) {
    return {
      estado: ESTADOS_PROXIMA_ACAO_ATIVACAO.REVISAR_PUBLICACAO,
      concluido: false,
      titulo: "Revise os dados do negócio",
      mensagem:
        "Seu serviço já está pronto. Revise os dados obrigatórios para colocar o perfil no ar.",
      acao: acaoNavegacao("Revisar meu negócio", "/painel/negocio"),
    };
  }

  if (!primeiroAgendamentoRecebido) {
    return {
      estado:
        ESTADOS_PROXIMA_ACAO_ATIVACAO.CONQUISTAR_PRIMEIRO_AGENDAMENTO,
      concluido: false,
      titulo: "Seu perfil está no ar",
      mensagem:
        "Compartilhe seu perfil para conquistar o primeiro agendamento. O AF já deixou uma sugestão de horários pronta e você pode alterá-la quando quiser.",
      acao: {
        tipo: "COMPARTILHAR_PERFIL",
        rotulo: "Compartilhar perfil",
      },
    };
  }

  return {
    estado: ESTADOS_PROXIMA_ACAO_ATIVACAO.ATIVADO,
    concluido: true,
    titulo: "Ativação concluída",
    mensagem:
      "Seu negócio já recebeu o primeiro agendamento pelo Agenda Fashion.",
    acao: acaoNavegacao("Abrir agenda", "/painel/agenda"),
  };
}

module.exports = {
  ESTADOS_PROXIMA_ACAO_ATIVACAO,
  resolverProximaAcaoAtivacao,
};
