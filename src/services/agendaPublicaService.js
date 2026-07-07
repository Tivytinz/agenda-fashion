const agendaPublicaRepository = require("../repositories/agendaPublicaRepository");

function gerarDiasProximos(qtd = 7) {
  const dias = [];
  const hoje = new Date();

  hoje.setHours(hoje.getHours() - 3);
  hoje.setHours(12, 0, 0, 0);

  for (let i = 0; i < qtd; i++) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() + i);

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    dias.push(`${ano}-${mes}-${dia}`);
  }

  return dias;
}

async function buscarDadosBaseAgenda({ slug, servicoId, profissionalId }) {
  const negocio = await agendaPublicaRepository.buscarNegocioPorSlug(slug);

  if (!negocio) {
    const erro = new Error("Negócio não encontrado.");
    erro.statusCode = 404;
    throw erro;
  }

  const servico = await agendaPublicaRepository.buscarServicoDoNegocio(
    servicoId,
    negocio.id
  );

  if (!servico) {
    const erro = new Error("Serviço não encontrado nesse negócio.");
    erro.statusCode = 404;
    throw erro;
  }

  const profissional =
    await agendaPublicaRepository.buscarProfissionalDoNegocio(
      profissionalId,
      negocio.id
    );

  if (!profissional) {
    const erro = new Error("Profissional não pertence a esse negócio.");
    erro.statusCode = 404;
    throw erro;
  }

  return {
    negocio,
    servico,
    profissional,
  };
}

function obterDataHoraBrasil() {
  const agora = new Date();

  agora.setHours(agora.getHours() - 3);

  const data =
    `${agora.getFullYear()}-` +
    `${String(agora.getMonth() + 1).padStart(2, "0")}-` +
    `${String(agora.getDate()).padStart(2, "0")}`;

  const hora =
    `${String(agora.getHours()).padStart(2, "0")}:` +
    `${String(agora.getMinutes()).padStart(2, "0")}`;

  return { data, hora };
}

function gerarHorariosBase() {
  return [
    "08:00", "09:00", "10:00", "11:00",
    "12:00", "13:00", "14:00", "15:00",
    "16:00", "17:00", "18:00", "19:00"
  ];
}

async function buscarDisponibilidade({ profissionalId }) {
  const dias = gerarDiasProximos(7);
  const horariosBase = gerarHorariosBase();

  const agendamentos = await agendaPublicaRepository.listarAgendamentosOcupados(
    profissionalId,
    dias[0],
    dias[dias.length - 1]
  );

  const bloqueios = await agendaPublicaRepository.listarBloqueios(
    profissionalId,
    dias[0],
    dias[dias.length - 1]
  );

  const ocupados = new Set(
    [...agendamentos, ...bloqueios].map(
      (item) => `${item.data}_${item.horario}`
    )
  );

  const agoraBrasil = obterDataHoraBrasil();

  return dias.map((data) => {
    const horarios = horariosBase.filter((hora) => {
      const ocupado = ocupados.has(`${data}_${hora}`);
      const horarioPassado =
        data === agoraBrasil.data && hora <= agoraBrasil.hora;

      return !ocupado && !horarioPassado;
    });

    return { data, horarios };
  });
}

async function obterOuCriarCliente({
  clienteId,
  clienteNome,
  clienteWhatsapp,
}) {
  if (clienteId) {
    return clienteId;
  }

  const clienteExistente =
    await agendaPublicaRepository.buscarClientePorWhatsapp(
      clienteWhatsapp.trim()
    );

  if (clienteExistente) {
    return clienteExistente.id;
  }

  const novoCliente =
    await agendaPublicaRepository.criarCliente(
      clienteNome,
      clienteWhatsapp
    );

  return novoCliente.id;
}

async function validarHorarioDisponivel({ profissionalId, data, horario }) {
  const bloqueio = await agendaPublicaRepository.buscarBloqueioHorario(
    profissionalId,
    data,
    horario
  );

  if (bloqueio) {
    const erro = new Error("Esse horário está bloqueado.");
    erro.statusCode = 400;
    throw erro;
  }

  const agendamento =
    await agendaPublicaRepository.buscarAgendamentoNoHorario(
      profissionalId,
      data,
      horario
    );

  if (agendamento) {
    const erro = new Error("Esse horário já está reservado.");
    erro.statusCode = 400;
    throw erro;
  }
}

async function criarAgendamento({
  data,
  horario,
  profissionalId,
  clienteId,
  servicoId,
  negocioId,
}) {
  return agendaPublicaRepository.criarAgendamento({
    data,
    horario,
    profissionalId,
    clienteId,
    servicoId,
    negocioId,
  });
}

module.exports = {
  gerarDiasProximos,
  buscarDadosBaseAgenda,
  buscarDisponibilidade,
  obterOuCriarCliente,
  validarHorarioDisponivel,
  criarAgendamento,
};