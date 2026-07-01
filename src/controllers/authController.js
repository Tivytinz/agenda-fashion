const authService = require("../services/authService");

// =========================
// CADASTRO
// =========================
async function cadastro(req, res, next) {
  try {
    const resultado = await authService.cadastro({
      nome: req.body.nome,
      email: req.body.email,
      senha: req.body.senha,
      whatsapp: req.body.whatsapp,
      tipo: req.body.tipo
    });

    return res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

// =========================
// LOGIN
// =========================
async function login(req, res, next) {
  try {
    const resultado = await authService.login({
      email: req.body.email,
      senha: req.body.senha
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

// =========================
// MEU NEGÓCIO
// =========================
async function meuNegocio(req, res, next) {
  try {
    const resultado = await authService.meuNegocio({
      usuarioId: req.user?.id
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  cadastro,
  login,
  meuNegocio
};