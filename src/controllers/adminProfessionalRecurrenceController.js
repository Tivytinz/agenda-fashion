const analysisService = require(
  "../services/adminProfessionalRecurrenceAnalysisService"
);

async function buscar(
  req,
  res,
  next
) {
  try {
    const resultado =
      await analysisService.buscar({
        periodo: req.query?.periodo,
      });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  buscar,
};
