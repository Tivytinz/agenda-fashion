const audit = require("../services/adminAuditService");

async function list(req, res, next) {
  try {
    const result = await audit.list({ admin: req.admin, query: req.query });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

async function review(req, res, next) {
  try {
    const result = await audit.review({
      admin: req.admin,
      tentativaId: req.params.id,
      avaliacao: req.body?.avaliacao,
      evidenciaTipo: req.body?.evidenciaTipo,
      evidenciaReferencia: req.body?.evidenciaReferencia
    });
    return res.status(201).json({ revisao: result });
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, review };
