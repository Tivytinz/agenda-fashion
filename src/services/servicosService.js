const servicosRepository = require("../repositories/servicosRepository");

async function listarServicos(usuarioId) {
  const vinculo =
    await servicosRepository.buscarNegocioDono(usuarioId);

  if (!vinculo) {
    return [];
  }

  return await servicosRepository.listarServicos(
    vinculo.negocio_id
  );
}

async function criarServico({
  usuarioId,
  nome,
  valor,
  duracaoMinutos,
}) {
  const vinculo =
    await servicosRepository.buscarNegocioDono(usuarioId);

  if (!vinculo) {
    const err = new Error("Apenas o dono pode criar serviços.");
    err.status = 403;
    throw err;
  }

  if (!nome || nome.trim().length < 2) {
    const err = new Error("Nome do serviço inválido.");
    err.status = 400;
    throw err;
  }

  const servico = await servicosRepository.criarServico({
    negocioId: vinculo.negocio_id,
    nome: nome.trim(),
    valor: Number(valor || 0),
    duracaoMinutos: Number(duracaoMinutos || 0),
  });

  return {
    mensagem: "Serviço criado com sucesso.",
    servico,
  };
}

async function editarServico({
  usuarioId,
  id,
  nome,
  valor,
  duracaoMinutos,
}) {
  const vinculo =
    await servicosRepository.buscarNegocioDono(usuarioId);

  if (!vinculo) {
    const err = new Error("Apenas o dono pode editar serviços.");
    err.status = 403;
    throw err;
  }

  const servico = await servicosRepository.editarServico({
    id,
    negocioId: vinculo.negocio_id,
    nome: nome?.trim(),
    valor: Number(valor || 0),
    duracaoMinutos: Number(duracaoMinutos || 0),
  });

  if (!servico) {
    const err = new Error("Serviço não encontrado.");
    err.status = 404;
    throw err;
  }

  return {
    mensagem: "Serviço atualizado com sucesso.",
    servico,
  };
}

module.exports = {
  listarServicos,
  criarServico,
  editarServico,
};