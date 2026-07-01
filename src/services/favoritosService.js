const favoritosRepository = require("../repositories/favoritosRepository");

const {
  exigirUsuario,
  exigirCliente,
  exigirRecurso
} = require("../validators/commonValidator");

function garantirCliente({ usuarioId, tipo }) {
  exigirUsuario(usuarioId);
  exigirCliente(tipo);
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

  exigirRecurso(negocio, "Negócio não encontrado.");

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