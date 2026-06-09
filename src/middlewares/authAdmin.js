function authAdmin(req, res, next) {
  if (!req.user || req.user.tipo !== "admin") {
    return res.status(403).json({
      erro: "Acesso permitido apenas para administradores."
    });
  }

  next();
}

module.exports = authAdmin;