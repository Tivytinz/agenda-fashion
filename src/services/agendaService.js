const agendaRepository = require("../repositories/agendaRepository");

const {
  exigirUsuario,
  exigirCampo,
  exigirRecurso,
  exigirPermissao
} = require("../validators/commonValidator");

const ValidationError = require("../errors/ValidationError");

function gerarDatasAgenda(quantidadeDias = 7) {
  const datas = [];

  for (let i = 0; i < quantidadeDias; i++) {
    const data = new Date();

    data.setHours(12, 0, 0, 0);
    data.setDate(data.getDate() + i);

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    datas.push(`${ano}-${mes}-${dia}`);
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

function criarChaveAgenda(data, hora) {
  return `${data}_${hora}`;
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

  const datas = gerarDatasAgenda(7);
  const horas = gerarHorariosAgenda(8, 18);

  const dataInicio = datas[0];
  const dataFim = datas[datas.length - 1];

  const bloqueios =
    await agendaRepository.buscarBloqueiosPorPeriodo(
      profissional.id,
      dataInicio,
      dataFim
    );

  const agendamentos =
    await agendaRepository.buscarAgendamentosPorPeriodo(
      profissional.id,
      dataInicio,
      dataFim
    );

  const mapaBloqueios = new Map(
    bloqueios.map((item) => [
      criarChaveAgenda(item.data, item.hora),
      item
    ])
  );

  const mapaAgendamentos = new Map(
    agendamentos.map((item) => [
      criarChaveAgenda(item.data, item.hora),
      item
    ])
  );

  const agenda = datas.map((data) => ({
    data,
    horarios: horas.map((hora) => {
      const chave = criarChaveAgenda(data, hora);

      let status = "livre";

      if (mapaBloqueios.has(chave)) {
        status = "bloqueado";
      }

      if (mapaAgendamentos.has(chave)) {
        status = "agendado";
      }

      return {
        hora,
        status
      };
    })
  }));

  return {
    profissional,
    agenda
  };
}

async function listarAgendaProfissional({ profissionalId }) {
  exigirUsuario(profissionalId);

  const datas = gerarDatasAgenda(7);
  const horas = gerarHorariosAgenda(8, 18);

  const dataInicio = datas[0];
  const dataFim = datas[datas.length - 1];

  const bloqueios =
    await agendaRepository.buscarBloqueiosPorPeriodo(
      profissionalId,
      dataInicio,
      dataFim
    );

  const agendamentos =
    await agendaRepository.buscarAgendamentosPorPeriodo(
      profissionalId,
      dataInicio,
      dataFim
    );

  const mapaBloqueios = new Map(
    bloqueios.map((item) => [
      criarChaveAgenda(item.data, item.hora),
      item
    ])
  );

  const mapaAgendamentos = new Map(
    agendamentos.map((item) => [
      criarChaveAgenda(item.data, item.hora),
      item
    ])
  );

  const agenda = datas.map((data) => ({
    data,
    horarios: horas.map((hora) => {
      const chave = criarChaveAgenda(data, hora);
      const agendamento = mapaAgendamentos.get(chave);

      let status = "livre";

      if (mapaBloqueios.has(chave)) {
        status = "bloqueado";
      }

      if (agendamento) {
        status = "agendado";
      }

      return {
        data,
        hora,
        status,
        cliente: agendamento?.cliente || null,
        servico: agendamento?.servico || null,
        valor: agendamento?.valor || null
      };
    })
  }));

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
    await agendaRepository.buscarProfissionaisDoNegocio(
      negocio.id
    );

  const datas = gerarDatasAgenda(7);
  const horas = gerarHorariosAgenda(8, 18);

  const dataInicio = datas[0];
  const dataFim = datas[datas.length - 1];

  const profissionalIds =
    profissionais.map((profissional) => profissional.id);

  if (profissionalIds.length === 0) {
    return { agenda: [] };
  }

  const bloqueios =
    await agendaRepository.buscarBloqueiosProfissionaisPorPeriodo(
      profissionalIds,
      dataInicio,
      dataFim
    );

  const agendamentos =
    await agendaRepository.buscarAgendamentosProfissionaisPorPeriodo(
      profissionalIds,
      dataInicio,
      dataFim
    );

  const mapaBloqueios = new Map(
    bloqueios.map((item) => [
      `${item.profissional_id}_${criarChaveAgenda(item.data, item.hora)}`,
      item
    ])
  );

  const mapaAgendamentos = new Map(
    agendamentos.map((item) => [
      `${item.profissional_id}_${criarChaveAgenda(item.data, item.hora)}`,
      item
    ])
  );

  const agenda = datas.map((data) => ({
    data,
    profissionais: profissionais.map((profissional) => ({
      id: profissional.id,
      nome: profissional.nome,
      foto_url: profissional.foto_url,
      horarios: horas.map((hora) => {
        const chave =
          `${profissional.id}_${criarChaveAgenda(data, hora)}`;

        const agendamento = mapaAgendamentos.get(chave);

        let status = "livre";

        if (mapaBloqueios.has(chave)) {
          status = "bloqueado";
        }

        if (agendamento) {
          status = "agendado";
        }

        return {
          hora,
          status,
          cliente: agendamento?.cliente || null,
          servico: agendamento?.servico || null
        };
      })
    }))
  }));

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