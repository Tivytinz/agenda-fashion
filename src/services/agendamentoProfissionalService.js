const agendamentoRepository = require("../repositories/agendamentoRepository");

const {
  exigirUsuario,
  exigirCampo
} = require("../validators/commonValidator");

const ValidationError = require("../errors/ValidationError");

async function listarAgendaProfissional({ profissionalId }) {
  exigirUsuario(profissionalId);

  return agendamentoRepository.listarAgendaProfissional(profissionalId);
}

async function alternarBloqueioHorario({
  profissionalId,
  data,
  hora
}) {
  exigirUsuario(profissionalId);

  exigirCampo(data, "Data é obrigatória.");
  exigirCampo(hora, "Hora é obrigatória.");

  const agendamento =
    await agendamentoRepository.buscarAgendamento(
      profissionalId,
      data,
      hora
    );

  if (agendamento) {
    throw new ValidationError(
      "Horário já está agendado."
    );
  }

  const bloqueio =
    await agendamentoRepository.buscarBloqueio(
      profissionalId,
      data,
      hora
    );

  if (bloqueio) {
    await agendamentoRepository.removerBloqueio(
      bloqueio.id
    );

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