const AppError = require("../errors/AppError");

function errorHandler(err, req, res, next) {
  if (
  process.env.NODE_ENV !== "production" &&
  process.env.NODE_ENV !== "test"
) {
  console.error(err);
}

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      erro: err.message,
    });
  }

  return res.status(500).json({
    erro: "Erro interno do servidor.",
  });
}

module.exports = errorHandler;