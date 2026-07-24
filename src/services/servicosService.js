const servicosRepository = require("../repositories/servicosRepository");
const uploadToCloudinary = require("../utils/uploadCloudinary");
const db = require("../db/db");
const { criarErroLimite } = require("./planoService");

function criarErro(mensagem, statusCode) {
  const err = new Error(mensagem);
  err.status = statusCode;
  err.statusCode = statusCode;
  return err;
}

async function obterVinculoDono(usuarioId, mensagem) {
  const vinculo = await servicosRepository.buscarNegocioDono(usuarioId);

  if (!vinculo) {
    throw criarErro(mensagem, 403);
  }

  return vinculo;
}

async function listarServicos(usuarioId) {
  const vinculo = await servicosRepository.buscarNegocioUsuario(usuarioId);

  if (!vinculo) {
    return [];
  }

  return servicosRepository.listarServicos(vinculo.negocio_id);
}

async function criarServico({ usuarioId, nome, valor, duracaoMinutos }) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode criar serviços."
  );

  if (!nome || nome.trim().length < 2) {
    throw criarErro("Nome do serviço inválido.", 400);
  }

  const servico = await db.executarTransacao(async (client) => {
    await servicosRepository.bloquearCadastroServico(
      client,
      vinculo.negocio_id
    );

    const plano = await servicosRepository.buscarPlanoDoNegocio(
      vinculo.negocio_id,
      client
    );

    if (!plano) {
      throw criarErro("Plano do negócio não encontrado.", 404);
    }

    const utilizados = await servicosRepository.contarServicosAtivos(
      vinculo.negocio_id,
      client
    );

    const limite = plano.limite_servicos;

    if (limite !== null && utilizados >= Number(limite)) {
      throw criarErroLimite(
        `Você atingiu o limite de ${limite} serviço(s) do plano ${plano.nome}. Faça upgrade para cadastrar mais.`,
        "LIMITE_SERVICOS",
        {
          plano_nome: plano.nome,
          utilizados,
          limite: Number(limite),
        }
      );
    }

    return servicosRepository.criarServico(
      {
        negocioId: vinculo.negocio_id,
        nome: nome.trim(),
        valor: Number(valor || 0),
        duracaoMinutos: Number(duracaoMinutos || 0),
      },
      client
    );
  });

  return {
    mensagem: "Serviço criado com sucesso.",
    servico,
  };
}

async function editarServico({ usuarioId, id, nome, valor, duracaoMinutos }) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode editar serviços."
  );

  if (!nome || nome.trim().length < 2) {
    throw criarErro("Nome do serviço inválido.", 400);
  }

  const servico = await servicosRepository.editarServico({
    id,
    negocioId: vinculo.negocio_id,
    nome: nome.trim(),
    valor: Number(valor || 0),
    duracaoMinutos: Number(duracaoMinutos || 0),
  });

  if (!servico) {
    throw criarErro("Serviço não encontrado.", 404);
  }

  return {
    mensagem: "Serviço atualizado com sucesso.",
    servico,
  };
}

async function removerServico({ usuarioId, id }) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode remover serviços."
  );

  const removido = await servicosRepository.removerServico({
    id,
    negocioId: vinculo.negocio_id,
  });

  if (!removido) {
    throw criarErro("Serviço não encontrado.", 404);
  }

  return {
    mensagem: "Serviço removido com sucesso.",
  };
}

async function enviarFotoServico({ usuarioId, id, file }) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode alterar foto do serviço."
  );

  if (!file) {
    throw criarErro("Nenhuma imagem enviada.", 400);
  }

  const resultado = await uploadToCloudinary(
    file.buffer,
    "saas-agendamento/servicos"
  );

  const servico = await servicosRepository.atualizarFotoServico({
    id,
    negocioId: vinculo.negocio_id,
    fotoUrl: resultado.secure_url,
    fotoPublicId: resultado.public_id,
  });

  if (!servico) {
    throw criarErro("Serviço não encontrado.", 404);
  }

  return {
    mensagem: "Foto do serviço atualizada.",
    servico,
  };
}

async function listarFotosServico(servicoId) {
  const fotos = await servicosRepository.listarFotosServico(servicoId);

  return { fotos };
}

async function adicionarFotoGaleriaServico({ usuarioId, id, file }) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode adicionar fotos ao serviço."
  );

  if (!file) {
    throw criarErro("Nenhuma imagem enviada.", 400);
  }

  const servico = await servicosRepository.buscarServicoDoNegocio(
    id,
    vinculo.negocio_id
  );

  if (!servico) {
    throw criarErro("Serviço não encontrado.", 404);
  }

  const resultado = await uploadToCloudinary(
    file.buffer,
    "saas-agendamento/servicos/galeria"
  );

  const foto = await servicosRepository.adicionarFotoGaleriaServico({
    servicoId: id,
    fotoUrl: resultado.secure_url,
    fotoPublicId: resultado.public_id,
  });

  return {
    mensagem: "Foto adicionada à galeria.",
    foto,
  };
}

async function removerFotoGaleriaServico({ usuarioId, fotoId }) {
  const vinculo = await obterVinculoDono(
    usuarioId,
    "Apenas o dono pode remover fotos do serviço."
  );

  const removida = await servicosRepository.removerFotoGaleriaServico({
    fotoId,
    negocioId: vinculo.negocio_id,
  });

  if (!removida) {
    throw criarErro("Foto não encontrada.", 404);
  }

  return {
    mensagem: "Foto removida da galeria.",
  };
}

module.exports = {
  listarServicos,
  criarServico,
  editarServico,
  removerServico,
  enviarFotoServico,
  listarFotosServico,
  adicionarFotoGaleriaServico,
  removerFotoGaleriaServico,
};
