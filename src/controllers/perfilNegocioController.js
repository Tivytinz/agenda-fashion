const perfilNegocioService = require("../services/perfilNegocioService");

// =============================
// 🌍 LISTAR NEGÓCIOS PÚBLICOS
// =============================
async function listarNegociosPublicos(req, res, next) {
  try {
    const resultado =
      await perfilNegocioService.listarNegociosPublicos({
        busca: req.query.busca,
        categoria: req.query.categoria,
        pagina: req.query.pagina,
        limite: req.query.limite
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

// =============================
// 🔍 BUSCAR PERFIL DO NEGÓCIO
// =============================
async function buscarPerfilPublico(req, res, next) {
  try {
    const resultado =
      await perfilNegocioService.buscarPerfilPublico({
        slug: req.params.slug
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarNegociosPublicos,
  buscarPerfilPublico
};
