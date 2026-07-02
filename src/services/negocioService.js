const usuarioRepository = require("../repositories/usuarioRepository");
const planoRepository = require("../repositories/planoRepository");
const negocioRepository = require("../repositories/negocioRepository");

const { criarClienteAsaas } = require("./asaasService");

const ValidationError = require("../errors/ValidationError");
const NotFoundError = require("../errors/NotFoundError");
const UnauthorizedError = require("../errors/UnauthorizedError");
const { gerarSlug } = require("../utils/slug");

async function criar({ usuarioId, nome }) {
  if (!usuarioId) {
    throw new UnauthorizedError("Usuário não autenticado.");
  }

  if (!nome || nome.trim().length < 3) {
    throw new ValidationError("Nome do negócio inválido.");
  }

  const usuario = await usuarioRepository.buscarPorId(usuarioId);

  if (!usuario) {
    throw new NotFoundError("Usuário não encontrado.");
  }

  const possuiNegocio =
    await negocioRepository.usuarioPossuiNegocio(usuarioId);

  if (possuiNegocio) {
    throw new ValidationError("Você já possui um negócio.");
  }

  const plano = await planoRepository.buscarPlanoGratis();

  if (!plano) {
    throw new NotFoundError("Plano gratuito não encontrado.");
  }

  const baseSlug = gerarSlug(nome);

  if (!baseSlug) {
    throw new ValidationError("Não foi possível gerar o slug.");
  }

  const slug = await negocioRepository.gerarSlugDisponivel(baseSlug);

  let customerId = null;

  try {
    const cliente = await criarClienteAsaas({
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.whatsapp
    });

    customerId = cliente.id;
  } catch (erro) {
    console.error("Erro ao criar cliente Asaas:", erro.response?.data || erro);

    throw new ValidationError(
      "Não foi possível criar o cliente no Asaas."
    );
  }

  const negocio = await negocioRepository.criar({
    nome: nome.trim(),
    slug,
    donoUsuarioId: usuarioId,
    planoId: plano.id,
    asaasCustomerId: customerId
  });

  await negocioRepository.vincularUsuario(
    usuarioId,
    negocio.id,
    "dono"
  );

  return {
    mensagem: "Negócio criado com sucesso.",
    negocio: {
      ...negocio,
      asaas_customer_id: customerId,
      papel: "dono",
      plano
    }
  };
}

async function buscarMeuNegocio(usuarioId) {
  if (!usuarioId) {
    throw new UnauthorizedError("Usuário não autenticado.");
  }

  const negocio = await negocioRepository.buscarDoUsuario(usuarioId);

  if (!negocio) {
    return {
      temNegocio: false
    };
  }

  const profissionais =
    await negocioRepository.listarProfissionais(negocio.id);

  return {
    temNegocio: true,
    negocio,
    profissionais
  };
}

async function buscarPorTermo(termo) {
  if (!termo || termo.trim().length < 2) {
    return {
      negocios: []
    };
  }

  const negocios =
    await negocioRepository.buscarPorTermo(
      termo.trim()
    );

  return {
    negocios
  };
}

async function entrarNoNegocio({ usuarioId, negocioId }) {
  if (!usuarioId) {
    throw new UnauthorizedError("Usuário não autenticado.");
  }

  if (!negocioId) {
    throw new ValidationError("Negócio não informado.");
  }

  const negocio = await negocioRepository.buscarPorId(negocioId);

  if (!negocio) {
    throw new NotFoundError("Negócio não encontrado.");
  }

  const vinculoExistente =
    await negocioRepository.buscarVinculo(usuarioId, negocioId);

  if (vinculoExistente) {
    throw new ValidationError("Você já está vinculado a este negócio.");
  }

  const vinculo =
    await negocioRepository.vincularProfissional(usuarioId, negocioId);

  return {
    mensagem: "Você entrou no negócio com sucesso.",
    negocio: {
      ...negocio,
      papel: vinculo.papel
    }
  };
}

module.exports = {
  criar,
  buscarMeuNegocio,
  buscarPorTermo,
  entrarNoNegocio
};