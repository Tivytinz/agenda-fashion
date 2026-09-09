const express = require("express");
const auth = require("../middlewares/auth");
const authAdmin = require("../middlewares/authAdmin");
const { disableDocumentCache } = require("../utils/httpCache");
const controller = require(
  "../controllers/adminAnalyticsV2Controller"
);

const router = express.Router();

router.use((_req, res, next) => {
  disableDocumentCache(res);
  return next();
});

router.get(
  "/admin/analytics-v2/:secao",
  auth,
  authAdmin,
  controller.buscar
);

module.exports = router;
