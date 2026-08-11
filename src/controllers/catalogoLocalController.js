const catalogoLocalService = require(
  "../services/catalogoLocalService"
);
const socialPreviewService = require(
  "../services/socialPreviewService"
);
const { disableDocumentCache } = require(
  "../utils/httpCache"
);

async function listarCatalogoLocal(req, res, next) {
  try {
    const resultado =
      await catalogoLocalService.listarCatalogoLocal({
        categoria: req.params.categoria,
        localidade: req.params.localidade,
        pagina: req.query.pagina,
        limite: req.query.limite
      });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function renderizarCatalogoLocal(req, res, next) {
  try {
    const resultado =
      await catalogoLocalService.listarCatalogoLocal({
        categoria: req.params.categoria,
        localidade: req.params.localidade,
        pagina: 1,
        limite: 1
      });

    const html = await socialPreviewService.lerHtmlReact();

    disableDocumentCache(res);

    return res
      .type("html")
      .send(
        socialPreviewService.injetarMetadados(
          html,
          resultado.metadados
        )
      );
  } catch (erro) {
    if (erro?.statusCode !== 404) {
      return next(erro);
    }

    try {
      const origem = socialPreviewService.origemPublica();
      const html = await socialPreviewService.lerHtmlReact();
      const url = new URL(req.path, origem).href;

      disableDocumentCache(res);

      return res
        .status(404)
        .type("html")
        .send(
          socialPreviewService.injetarMetadados(
            html,
            {
              titulo: "Serviços não encontrados | Agenda Fashion",
              descricao: "Ainda não há serviços publicados para esta categoria e localidade no Agenda Fashion.",
              imagem: `${origem}/social-preview.png`,
              url,
              robots: "noindex,follow"
            }
          )
        );
    } catch (renderError) {
      return next(renderError);
    }
  }
}

async function servirSitemap(_req, res, next) {
  try {
    const sitemap = await catalogoLocalService.gerarSitemap();

    res.setHeader(
      "Cache-Control",
      "public, max-age=3600"
    );

    return res
      .type("application/xml")
      .send(sitemap);
  } catch (erro) {
    return next(erro);
  }
}

function servirRobots(_req, res) {
  res.setHeader(
    "Cache-Control",
    "public, max-age=86400"
  );

  return res
    .type("text/plain")
    .send(catalogoLocalService.gerarRobotsTxt());
}

module.exports = {
  listarCatalogoLocal,
  renderizarCatalogoLocal,
  servirRobots,
  servirSitemap
};
