function orientarDisponibilidade(ativacao = {}, { posAtivacao = false } = {}) {
  const motivo = ativacao?.motivo_indisponibilidade;
  let titulo;
  let mensagem;
  let rotulo;
  let destino;

  if (motivo === "SEM_PROFISSIONAL_HABILITADA") {
    titulo = "Habilite uma profissional para seus serviços";
    mensagem = "Há serviço ativo, mas nenhuma profissional ativa está habilitada para realizá-lo. Revise os serviços oferecidos pela equipe antes de divulgar.";
    rotulo = "Gerenciar serviços da equipe";
    destino = "/painel/profissionais";
  } else if (motivo === "DURACAO_INCOMPATIVEL") {
    titulo = "Ajuste as faixas de atendimento";
    mensagem = "Os horários ativos não comportam a duração inteira de um serviço habilitado, considerando as pausas. Revise as faixas de atendimento antes de divulgar.";
    rotulo = "Revisar horários";
    destino = "/painel/horarios";
  } else {
    titulo = posAtivacao
      ? "Revise os horários antes de divulgar"
      : "Adicione horários para receber agendamentos";
    mensagem = "Seu perfil está publicado, mas ainda não há horários de atendimento para uma profissional habilitada receber novas reservas. Revise os dias e horários antes de divulgar.";
    rotulo = posAtivacao ? "Revisar horários" : "Configurar horários";
    destino = "/painel/horarios";
  }

  if (motivo !== "SEM_PROFISSIONAL_HABILITADA" && ativacao?.revisar_horarios_na_equipe === true) {
    mensagem += " Abra a equipe e configure os horários de uma profissional habilitada.";
    rotulo = "Revisar horários da equipe";
    destino = "/painel/profissionais";
  }

  if (posAtivacao) {
    mensagem += " Se a pausa for intencional, mantenha sua configuração.";
  }

  return {
    titulo,
    mensagem,
    acao: { tipo: "NAVEGAR", rotulo, destino },
  };
}

module.exports = { orientarDisponibilidade };
