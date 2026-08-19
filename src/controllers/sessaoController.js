const sessaoService = require(
  "../services/sessaoService"
);

/*
 * GET /minha-sessao
 *
 * Retorna:
 * - dados da conta autenticada;
 * - vínculo ativo com negócio;
 * - papel contextual de dono ou profissional.
 */
async function obterMinhaSessao(
  req,
  res,
  next
) {
  try {
    const usuarioId =
      req.user?.id;

    const resultado =
      await sessaoService
        .obterMinhaSessao(
          usuarioId
        );

    res.set("Cache-Control", "no-store");

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  obterMinhaSessao,
};
