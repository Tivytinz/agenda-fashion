const favoritosRepository = require("../repositories/favoritosRepository");

function garantirCliente({ usuarioId, tipo }) {
  if (!usuarioId) {
    throw new Error("Usuário não autenticado.");
  }

  if (tipo !== "cliente") {
    throw new Error("Apenas clientes podem favoritar.");
  }
}

async function listarFavoritos({ usuarioId, tipo }) {
  garantirCliente({ usuarioId, tipo });

  const favoritos =
    await favoritosRepository.listarFavoritos(usuarioId);

  return { favoritos };
}

async function adicionarFavorito({ usuarioId, tipo, negocioId }) {
  garantirCliente({ usuarioId, tipo });

  const negocio =
    await favoritosRepository.buscarNegocio(negocioId);

  if (!negocio) {
    throw new Error("Negócio não encontrado.");
  }

  await favoritosRepository.adicionarFavorito(
    usuarioId,
    negocioId
  );

  return {
    mensagem: "Adicionado aos favoritos."
  };
}

async function removerFavorito({ usuarioId, tipo, negocioId }) {
  garantirCliente({ usuarioId, tipo });

  await favoritosRepository.removerFavorito(
    usuarioId,
    negocioId
  );

  return {
    mensagem: "Removido dos favoritos."
  };
}

async function verificarFavorito({ usuarioId, tipo, negocioId }) {
  garantirCliente({ usuarioId, tipo });

  const favoritado =
    await favoritosRepository.verificarFavorito(
      usuarioId,
      negocioId
    );

  return { favoritado };
}

module.exports = {
  listarFavoritos,
  adicionarFavorito,
  removerFavorito,
  verificarFavorito
};