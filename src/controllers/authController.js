const authService = require("../services/authService");

async function cadastro(req, res) {
  try {
    const resultado = await authService.cadastro(req.body);

    return res.status(201).json(resultado);

  } catch (err) {
    console.error("Erro no cadastro:", err);

    return res.status(err.status || 400).json({
      erro: err.message || "Erro no cadastro."
    });
  }
}

async function login(req, res) {
  try {
    const resultado = await authService.login(req.body);

    return res.json(resultado);

  } catch (err) {
    console.error("Erro no login:", err);

    return res.status(err.status || 400).json({
      erro: err.message || "Erro no login."
    });
  }
}

async function meuNegocio(req, res) {
  try {
    const resultado = await authService.meuNegocio(req.user?.id);

    return res.json(resultado);

  } catch (err) {
    console.error("Erro ao buscar meu negócio:", err);

    return res.status(err.status || 500).json({
      erro: err.message || "Erro ao buscar negócio."
    });
  }
}

module.exports = {
  cadastro,
  login,
  meuNegocio
};