const audit = require("../services/adminAuditService");

async function list(req, res, next) {
  try {
    const result = await audit.list({ admin: req.admin, query: req.query });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { list };
