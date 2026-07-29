const servicosService = require("../services/servicosService");

async function listarServicos(req, res, next) {
  try {
    const resultado = await servicosService.listarServicos(req.user?.id);

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function criarServico(req, res, next) {
  try {
    const resultado = await servicosService.criarServico({
      usuarioId: req.user?.id,
      nome: req.body.nome,
      descricao: req.body.descricao,
      valor: req.body.valor,
      duracaoMinutos: req.body.duracao_minutos,
      ativo: req.body.ativo,
    });

    return res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function editarServico(req, res, next) {
  try {
    const resultado = await servicosService.editarServico({
      usuarioId: req.user?.id,
      id: req.params.id,
      nome: req.body.nome,
      descricao: req.body.descricao,
      valor: req.body.valor,
      duracaoMinutos: req.body.duracao_minutos,
      ativo: req.body.ativo,
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function removerServico(req, res, next) {
  try {
    const resultado = await servicosService.removerServico({
      usuarioId: req.user?.id,
      id: req.params.id,
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function enviarFotoServico(req, res, next) {
  try {
    const resultado = await servicosService.enviarFotoServico({
      usuarioId: req.user?.id,
      id: req.params.id,
      file: req.file,
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function listarFotosServico(req, res, next) {
  try {
    const resultado = await servicosService.listarFotosServico(
      req.params.id
    );

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function adicionarFotoGaleriaServico(req, res, next) {
  try {
    const resultado = await servicosService.adicionarFotoGaleriaServico({
      usuarioId: req.user?.id,
      id: req.params.id,
      file: req.file,
    });

    return res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function removerFotoGaleriaServico(req, res, next) {
  try {
    const resultado = await servicosService.removerFotoGaleriaServico({
      usuarioId: req.user?.id,
      fotoId: req.params.fotoId,
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
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
