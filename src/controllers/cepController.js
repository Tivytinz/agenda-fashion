const cepService = require("../services/cepService");

async function buscarCep(req, res, next) {
  try {
    const endereco = await cepService.buscarCep(req.params.cep);
    return res.json(endereco);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  buscarCep,
};
