const agendamentoRepository = require("../repositories/agendamentoRepository");

async function listarAgendaProfissional({ profissionalId }) {
  if (!profissionalId) {
    throw new Error("Usuário não autenticado.");
  }

  return await agendamentoRepository.listarAgendaProfissional(profissionalId);
}

async function alternarBloqueioHorario({
  profissionalId,
  data,
  hora
}) {
  if (!profissionalId) {
    throw new Error("Usuário não autenticado.");
  }

  if (!data || !hora) {
    throw new Error("Data e hora obrigatórios.");
  }

  const agendamento =
    await agendamentoRepository.buscarAgendamento(
      profissionalId,
      data,
      hora
    );

  if (agendamento) {
    throw new Error("Horário já está agendado.");
  }

  const bloqueio =
    await agendamentoRepository.buscarBloqueio(
      profissionalId,
      data,
      hora
    );

  if (bloqueio) {
    await agendamentoRepository.removerBloqueio(bloqueio.id);

    return {
      sucesso: true,
      status: "livre",
      mensagem: "Horário liberado com sucesso."
    };
  }

  await agendamentoRepository.criarBloqueio(
    profissionalId,
    data,
    hora
  );

  return {
    sucesso: true,
    status: "bloqueado",
    mensagem: "Horário bloqueado com sucesso."
  };
}

module.exports = {
  listarAgendaProfissional,
  alternarBloqueioHorario
};