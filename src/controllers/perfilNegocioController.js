const perfilNegocioService = require("../services/perfilNegocioService");
const socialPreviewService = require("../services/socialPreviewService");
const { criarImagemPadrao } = require("../utils/socialPreviewImage");
const { disableDocumentCache } = require("../utils/httpCache");

// =============================
// 🌍 LISTAR NEGÓCIOS PÚBLICOS
// =============================
async function listarNegociosPublicos(req, res, next) {
  try {
    const resultado =
      await perfilNegocioService.listarNegociosPublicos({
        busca: req.query.busca,
        categoria: req.query.categoria,
        cidade: req.query.cidade,
        estado: req.query.estado,
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

async function renderizarPerfilPublico(req, res, next) {
  try {
    const previa = await socialPreviewService.buscarPrevia({
      slug: req.params.slug,
      servicoId: req.query.servico
    });

    if (!previa) {
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
              titulo: "Negócio não encontrado | Agenda Fashion",
              descricao: "Este negócio não está disponível no Agenda Fashion.",
              imagem: `${origem}/social-preview.png`,
              url,
              robots: "noindex,follow"
            }
          )
        );
    }

    if (previa.negocio.slug !== previa.slugSolicitado) {
      const destino = new URL(
        `/negocio/${encodeURIComponent(previa.negocio.slug)}`,
        socialPreviewService.origemPublica()
      );

      for (const [chave, valor] of Object.entries(req.query)) {
        const valores = Array.isArray(valor) ? valor : [valor];

        for (const item of valores) {
          if (typeof item === "string" && item.length <= 500) {
            destino.searchParams.append(chave, item);
          }
        }
      }

      return res.redirect(301, `${destino.pathname}${destino.search}`);
    }

    const html = await socialPreviewService.lerHtmlReact();

    disableDocumentCache(res);

    return res
      .type("html")
      .send(
        socialPreviewService.injetarMetadados(
          html,
          previa.metadados
        )
      );
  } catch (erro) {
    return next(erro);
  }
}

function servirImagemSocialPadrao(_req, res) {
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.type("png").send(criarImagemPadrao());
}

module.exports = {
  listarNegociosPublicos,
  buscarPerfilPublico,
  renderizarPerfilPublico,
  servirImagemSocialPadrao
};
