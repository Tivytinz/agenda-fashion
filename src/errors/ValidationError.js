const AppError = require("./AppError");

class ValidationError extends AppError {
  constructor(message = "Dados inválidos.") {
    super(message, 400);
  }
}

module.exports = ValidationError;