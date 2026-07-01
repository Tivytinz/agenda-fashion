const agendaRepository = require("../repositories/agendaRepository");

const {
  exigirUsuario,
  exigirCampo,
  exigirRecurso,
  exigirPermissao
} = require("../validators/commonValidator");

const ValidationError = require("../errors/ValidationError");

function gerarDatasAgenda(quantidadeDias = 6) {
  const datas = [];

  for (let i = 0; i < quantidadeDias; i++) {
    const dataObj = new Date();
    dataObj.setDate(dataObj.getDate() + i);

    datas.push(dataObj.toISOString().slice(0, 10));
  }

  return datas;
}

function gerarHorariosAgenda(horaInicio = 8, horaFim = 18) {
  const horarios = [];

  for (let hora = horaInicio; hora <= horaFim; hora++) {
    horarios.push(`${String(hora).padStart(2, "0")}:00`);
  }

  return horarios;
}

async function buscarAgendaPublica({ slugNegocio, slugProfissional }) {
  exigirCampo(slugNegocio, "Slug do negócio não informado.");
  exigirCampo(slugProfissional, "Slug do profissional não informado.");

  const profissional =
    await agendaRepository.buscarProfissionalPorSlug(
      slugNegocio,
      slugProfissional
    );

  exigirRecurso(profissional, "Profissional não encontrado.");

  const datas = gerarDatasAgenda(6);
  const horas = gerarHorariosAgenda(8, 18);

  const agenda = [];

  for (const data of datas) {
    const horarios = [];

    for (const hora of horas) {
      const bloqueado =
        await agendaRepository.buscarBloqueioHorario(
          profissional.id,
          data,
          hora
        );

      const agendamento =
        await agendaRepository.buscarAgendamentoHorario(
          profissional.id,
          data,
          hora
        );

      let status = "livre";

      if (bloqueado) status = "bloqueado";
      if (agendamento) status = "agendado";

      horarios.push({
        hora,
        status
      });
    }

    agenda.push({
      data,
      horarios
    });
  }

  return {
    profissional,
    agenda
  };
}

async function listarAgendaProfissional({ profissionalId }) {
  exigirUsuario(profissionalId);

  const datas = gerarDatasAgenda(6);
  const horas = gerarHorariosAgenda(8, 18);

  const agenda = [];

  for (const data of datas) {
    const horarios = [];

    for (const hora of horas) {
      const bloqueado =
        await agendaRepository.buscarBloqueioHorarioPainel(
          profissionalId,
          data,
          hora
        );

      const agendamento =
        await agendaRepository.buscarAgendamentoHorarioPainel(
          profissionalId,
          data,
          hora
        );

      let status = "livre";

      if (bloqueado) status = "bloqueado";
      if (agendamento) status = "agendado";

      horarios.push({
        data,
        hora,
        status,
        cliente: agendamento?.cliente || null,
        servico: agendamento?.servico || null,
        valor: agendamento?.valor || null
      });
    }

    agenda.push({
      data,
      horarios
    });
  }

  return { agenda };
}

async function alternarBloqueioHorario({
  usuarioId,
  data,
  hora,
  profissionalIdSolicitado
}) {
  exigirUsuario(usuarioId);
  exigirCampo(data, "Data é obrigatória.");
  exigirCampo(hora, "Hora é obrigatória.");

  let profissionalId = usuarioId;

  if (profissionalIdSolicitado) {
    const dono = await agendaRepository.buscarNegocioDono(usuarioId);

    exigirPermissao(
      dono,
      "Apenas o dono pode bloquear horários de outros profissionais."
    );

    const profissionalPertence =
      await agendaRepository.verificarProfissionalNoNegocio(
        profissionalIdSolicitado,
        dono.negocio_id
      );

    exigirPermissao(
      profissionalPertence,
      "Este profissional não pertence ao seu negócio."
    );

    profissionalId = profissionalIdSolicitado;
  }

  const agendamento =
    await agendaRepository.buscarAgendamentoAtivo(
      profissionalId,
      data,
      hora
    );

  if (agendamento) {
    throw new ValidationError("Horário já está agendado.");
  }

  const bloqueio =
    await agendaRepository.buscarBloqueioHorarioNovo(
      profissionalId,
      data,
      hora
    );

  if (bloqueio) {
    await agendaRepository.removerBloqueioHorario(bloqueio.id);

    return {
      sucesso: true,
      status: "livre",
      mensagem: "Horário liberado com sucesso."
    };
  }

  await agendaRepository.criarBloqueioHorario(
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

async function buscarAgendaGeral({ usuarioId }) {
  exigirUsuario(usuarioId);

  const negocio =
    await agendaRepository.buscarNegocioDoUsuario(usuarioId);

  exigirRecurso(negocio, "Negócio não encontrado.");

  const profissionais =
    await agendaRepository.buscarProfissionaisDoNegocio(negocio.id);

  const datas = gerarDatasAgenda(7);
  const horas = gerarHorariosAgenda(8, 18);

  const agenda = [];

  for (const data of datas) {
    const profissionaisAgenda = [];

    for (const profissional of profissionais) {
      const horarios = [];

      for (const hora of horas) {
        const bloqueio =
          await agendaRepository.buscarBloqueioHorarioGeral(
            profissional.id,
            data,
            hora
          );

        const agendamento =
          await agendaRepository.buscarAgendamentoHorarioGeral(
            profissional.id,
            data,
            hora
          );

        let status = "livre";

        if (bloqueio) status = "bloqueado";
        if (agendamento) status = "agendado";

        horarios.push({
          hora,
          status,
          cliente: agendamento?.cliente || null,
          servico: agendamento?.servico || null
        });
      }

      profissionaisAgenda.push({
        id: profissional.id,
        nome: profissional.nome,
        foto_url: profissional.foto_url,
        horarios
      });
    }

    agenda.push({
      data,
      profissionais: profissionaisAgenda
    });
  }

  return { agenda };
}

async function buscarNotificacoesAgenda({ usuarioId }) {
  exigirUsuario(usuarioId);

  const vinculo =
    await agendaRepository.buscarVinculoUsuarioNegocio(usuarioId);

  if (!vinculo) {
    return { total: 0 };
  }

  let total = 0;

  if (vinculo.papel === "dono") {
    total =
      await agendaRepository.contarNotificacoesAgendaDono(
        vinculo.negocio_id
      );
  } else {
    total =
      await agendaRepository.contarNotificacoesAgendaProfissional(
        usuarioId
      );
  }

  return { total };
}

module.exports = {
  buscarAgendaPublica,
  listarAgendaProfissional,
  alternarBloqueioHorario,
  buscarAgendaGeral,
  buscarNotificacoesAgenda
};