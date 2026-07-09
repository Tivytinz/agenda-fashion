const agendaPublicaRepository = require("../repositories/agendaPublicaRepository");

function criarErro(mensagem, statusCode) {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  erro.status = statusCode;
  return erro;
}

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

function obterDataHoraBrasil() {
  const agora = new Date();

  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(agora);

  const get = (tipo) =>
    partes.find((p) => p.type === tipo)?.value;

  return {
    data: `${get("year")}-${get("month")}-${get("day")}`,
    hora: `${get("hour")}:${get("minute")}`
  };
}

function gerarHorariosBase() {
  return [
    "08:00", "09:00", "10:00", "11:00",
    "12:00", "13:00", "14:00", "15:00",
    "16:00", "17:00", "18:00", "19:00"
  ];
}

function validarClienteAutenticado({ clienteId, tipoUsuario }) {
  if (!clienteId) {
    throw criarErro("Cliente não autenticado.", 401);
  }

  if (tipoUsuario !== "cliente") {
    throw criarErro("Apenas clientes podem acessar este recurso.", 403);
  }
}

async function buscarDadosBaseAgenda({ slug, servicoId, profissionalId }) {
  const negocio = await agendaPublicaRepository.buscarNegocioPorSlug(slug);

  if (!negocio) {
    throw criarErro("Negócio não encontrado.", 404);
  }

  const servico = await agendaPublicaRepository.buscarServicoDoNegocio(
    servicoId,
    negocio.id
  );

  if (!servico) {
    throw criarErro("Serviço não encontrado nesse negócio.", 404);
  }

  const profissional =
    await agendaPublicaRepository.buscarProfissionalDoNegocio(
      profissionalId,
      negocio.id
    );

  if (!profissional) {
    throw criarErro("Profissional não pertence a esse negócio.", 404);
  }

  return {
    negocio,
    servico,
    profissional,
  };
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

  if (!clienteNome || !clienteWhatsapp) {
    throw criarErro("Nome e WhatsApp do cliente são obrigatórios.", 400);
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
    throw criarErro("Esse horário está bloqueado.", 400);
  }

  const agendamento =
    await agendaPublicaRepository.buscarAgendamentoNoHorario(
      profissionalId,
      data,
      horario
    );

  if (agendamento) {
    throw criarErro("Esse horário já está reservado.", 400);
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

async function criarNotificacaoAgendamento({
  usuarioId,
  negocioId,
  agendamentoId,
  titulo,
  mensagem,
}) {
  return agendaPublicaRepository.criarNotificacaoAgendamento({
    usuarioId,
    negocioId,
    agendamentoId,
    titulo,
    mensagem,
  });
}

async function listarMeusAgendamentos({ clienteId, tipoUsuario }) {
  validarClienteAutenticado({ clienteId, tipoUsuario });

  const agendamentos =
    await agendaPublicaRepository.listarMeusAgendamentos(clienteId);

  return { agendamentos };
}

function validarAgendamentoCancelavel(agendamento) {
  if (agendamento.status === "cancelado") {
    throw criarErro("Esse agendamento já está cancelado.", 400);
  }

  const dataAgendamento = new Date(`${agendamento.data}T00:00:00`);
  const hoje = new Date();

  hoje.setHours(hoje.getHours() - 3);
  hoje.setHours(0, 0, 0, 0);

  if (dataAgendamento < hoje) {
    throw criarErro("Não é possível cancelar um agendamento já realizado.", 400);
  }
}

async function cancelarMeuAgendamento({ clienteId, tipoUsuario, agendamentoId }) {
  validarClienteAutenticado({ clienteId, tipoUsuario });

  const agendamento =
    await agendaPublicaRepository.buscarAgendamentoCliente(
      agendamentoId,
      clienteId
    );

  if (!agendamento) {
    throw criarErro("Agendamento não encontrado.", 404);
  }

  validarAgendamentoCancelavel(agendamento);

  await agendaPublicaRepository.cancelarAgendamento(
    agendamentoId,
    clienteId
  );

  return {
    mensagem: "Agendamento cancelado com sucesso.",
  };
}

function validarAvaliacao(nota) {
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    throw criarErro("A avaliação deve ser de 1 a 5 estrelas.", 400);
  }
}

function validarAgendamentoAvaliavel(agendamento) {
  if (agendamento.status === "cancelado") {
    throw criarErro("Agendamento cancelado não pode ser avaliado.", 400);
  }

  const dataAgendamento = new Date(`${agendamento.data}T00:00:00`);
  const hoje = new Date();

  hoje.setHours(hoje.getHours() - 3);
  hoje.setHours(0, 0, 0, 0);

  if (dataAgendamento >= hoje) {
    throw criarErro("Só é possível avaliar serviços já realizados.", 400);
  }

  if (agendamento.avaliacao) {
    throw criarErro("Esse agendamento já foi avaliado.", 400);
  }
}

async function avaliarAgendamento({
  clienteId,
  tipoUsuario,
  agendamentoId,
  avaliacao,
}) {
  validarClienteAutenticado({ clienteId, tipoUsuario });

  const nota = Number(avaliacao);

  validarAvaliacao(nota);

  const agendamento =
    await agendaPublicaRepository.buscarAgendamentoCliente(
      agendamentoId,
      clienteId
    );

  if (!agendamento) {
    throw criarErro("Agendamento não encontrado.", 404);
  }

  validarAgendamentoAvaliavel(agendamento);

  await agendaPublicaRepository.avaliarAgendamento(
    agendamentoId,
    clienteId,
    nota
  );

  return {
    mensagem: "Avaliação salva com sucesso.",
    avaliacao: nota,
  };
}

module.exports = {
  gerarDiasProximos,
  buscarDadosBaseAgenda,
  buscarDisponibilidade,
  obterOuCriarCliente,
  validarHorarioDisponivel,
  criarAgendamento,
  criarNotificacaoAgendamento,
  listarMeusAgendamentos,
  cancelarMeuAgendamento,
  avaliarAgendamento,
};