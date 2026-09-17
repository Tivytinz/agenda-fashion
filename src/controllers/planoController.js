const planoService = require("../services/planoService");
const registrador = require("../utils/registrador");

async function listarPlanos(req, res, next) {
  const accept = String(
    req.headers.accept || ""
  ).toLowerCase();
  const solicitaJson =
    accept.includes("application/json") &&
    !accept.includes("text/html");

  res.vary("Accept");

  if (!solicitaJson) {
    return next();
  }

  try {
    const planos = await planoService.listarPlanosAtivos();

    return res.json({ planos });
  } catch (erro) {
    registrador.erro(
      "Não foi possível listar os planos.",
      erro
    );

    return res.status(500).json({
      erro: "Erro ao listar planos.",
    });
  }
}

async function buscarMeuPlano(req, res) {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({
        erro: "Usuário não autenticado.",
      });
    }

    const plano = await planoService.buscarMeuPlano(
      usuarioId
    );

    if (!plano) {
      return res.status(404).json({
        erro: "Negócio não encontrado.",
      });
    }

    return res.json(plano);
  } catch (erro) {
    registrador.erro(
      "Não foi possível buscar o plano atual.",
      erro
    );

    return res.status(500).json({
      erro: "Erro ao buscar plano atual.",
    });
  }
}

module.exports = {
  listarPlanos,
  buscarMeuPlano,
};
