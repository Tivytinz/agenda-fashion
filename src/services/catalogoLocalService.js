const AppError = require("../errors/AppError");
const catalogoLocalRepository = require(
  "../repositories/catalogoLocalRepository"
);
const perfilNegocioService = require(
  "./perfilNegocioService"
);
const socialPreviewService = require(
  "./socialPreviewService"
);
const catalogoLocal = require(
  "../config/catalogLocal.json"
);
const { gerarSlug } = require("../utils/slug");

const categoriasPorCodigo = new Map(
  Object.entries(catalogoLocal).map(
    ([slug, config]) => [
      config.categoria,
      { slug, ...config }
    ]
  )
);

function resolverCategoria(slug) {
  const categoriaSlug = gerarSlug(slug);
  const config = catalogoLocal[categoriaSlug];

  if (!config) {
    throw new AppError(
      "Categoria local não encontrada.",
      404
    );
  }

  return {
    slug: categoriaSlug,
    ...config
  };
}

function resolverLocalidade(slug) {
  const localidadeSlug = gerarSlug(slug);
  const correspondencia = localidadeSlug.match(
    /^(.+)-([a-z]{2})$/
  );

  if (!correspondencia) {
    throw new AppError(
      "Localidade não encontrada.",
      404
    );
  }

  return {
    slug: localidadeSlug,
    cidadeSlug: correspondencia[1],
    estado: correspondencia[2].toUpperCase()
  };
}

function caminhoCatalogoLocal({
  categoriaSlug,
  cidade,
  estado
}) {
  return `/servicos/${categoriaSlug}/em/${gerarSlug(
    cidade
  )}-${String(estado || "").toLowerCase()}`;
}

function montarMetadados({
  categoria,
  localidade
}) {
  const origem = socialPreviewService.origemPublica();
  const caminho = caminhoCatalogoLocal({
    categoriaSlug: categoria.slug,
    cidade: localidade.cidade,
    estado: localidade.estado
  });
  const local = `${localidade.cidade} - ${localidade.estado}`;

  return {
    titulo: `${categoria.titulo} em ${local} | Agenda Fashion`,
    descricao: `Encontre ${categoria.descricao} em ${local}. Compare profissionais, serviços e preços e agende online pelo Agenda Fashion.`,
    imagem: `${origem}/social-preview.png`,
    url: `${origem}${caminho}`
  };
}

async function listarCatalogoLocal({
  categoria: categoriaSlug,
  localidade: localidadeSlug,
  pagina,
  limite
}) {
  const categoriaSolicitada = String(
    categoriaSlug || ""
  ).trim();
  const localidadeSolicitadaOriginal = String(
    localidadeSlug || ""
  ).trim();

  const categoria = resolverCategoria(categoriaSlug);
  const localidadeSolicitada = resolverLocalidade(
    localidadeSlug
  );

  const localidade =
    await catalogoLocalRepository.buscarLocalidadePublica({
      cidadeSlug: localidadeSolicitada.cidadeSlug,
      estado: localidadeSolicitada.estado
    });

  if (!localidade) {
    throw new AppError(
      "Localidade não encontrada.",
      404
    );
  }

  const resultado =
    await perfilNegocioService.listarNegociosPublicos({
      categoria: categoria.categoria,
      cidade: localidade.cidade,
      estado: localidade.estado,
      pagina,
      limite
    });

  if (resultado.paginacao.total < 1) {
    throw new AppError(
      "Ainda não há serviços publicados para esta categoria e localidade.",
      404
    );
  }

  const caminhoCanonico = caminhoCatalogoLocal({
    categoriaSlug: categoria.slug,
    cidade: localidade.cidade,
    estado: localidade.estado
  });
  const localidadeCanonica =
    caminhoCanonico.split("/").pop();
  const precisaRedirecionar =
    categoriaSolicitada !== categoria.slug ||
    localidadeSolicitadaOriginal !== localidadeCanonica;

  return {
    ...resultado,
    filtro: {
      categoria: categoria.categoria,
      categoria_slug: categoria.slug,
      titulo: categoria.titulo,
      descricao: categoria.descricao,
      cidade: localidade.cidade,
      estado: localidade.estado,
      localidade_slug: `${gerarSlug(localidade.cidade)}-${String(
        localidade.estado
      ).toLowerCase()}`,
      caminho_canonico: caminhoCanonico
    },
    redirecionamento:
      precisaRedirecionar
        ? { caminho: caminhoCanonico }
        : null,
    metadados: montarMetadados({
      categoria,
      localidade
    })
  };
}

function escaparXml(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function dataSitemap(valor) {
  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  return data.toISOString().slice(0, 10);
}

async function gerarSitemap() {
  const origem = socialPreviewService.origemPublica();
  const linhas =
    await catalogoLocalRepository.listarEntradasSitemap();

  const urls = new Map();

  const adicionar = (caminho, atualizadoEm) => {
    const url = `${origem}${caminho}`;
    const atual = urls.get(url);
    const proximaData = dataSitemap(atualizadoEm);

    if (!atual || (
      proximaData &&
      (!atual.lastmod || proximaData > atual.lastmod)
    )) {
      urls.set(url, {
        loc: url,
        lastmod: proximaData || atual?.lastmod || null
      });
    }
  };

  adicionar("/", null);
  adicionar("/para-profissionais", null);

  for (const linha of linhas) {
    if (linha.slug) {
      adicionar(
        `/negocio/${encodeURIComponent(linha.slug)}`,
        linha.updated_at
      );
    }

    const categoria = categoriasPorCodigo.get(
      linha.categoria
    );

    if (
      categoria &&
      linha.cidade &&
      /^[A-Z]{2}$/.test(String(linha.estado || ""))
    ) {
      adicionar(
        caminhoCatalogoLocal({
          categoriaSlug: categoria.slug,
          cidade: linha.cidade,
          estado: linha.estado
        }),
        linha.updated_at
      );
    }
  }

  const corpo = Array.from(urls.values())
    .map(({ loc, lastmod }) => [
      "  <url>",
      `    <loc>${escaparXml(loc)}</loc>`,
      lastmod
        ? `    <lastmod>${lastmod}</lastmod>`
        : null,
      "  </url>"
    ].filter(Boolean).join("\n"))
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    corpo,
    "</urlset>"
  ].join("\n");
}

function gerarRobotsTxt() {
  const origem = socialPreviewService.origemPublica();

  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin/",
    "Disallow: /painel/",
    "Disallow: /profissional/",
    "Disallow: /checkout",
    "Disallow: /conta",
    "Disallow: /favoritos",
    "Disallow: /minha-agenda",
    `Sitemap: ${origem}/sitemap.xml`,
    ""
  ].join("\n");
}

module.exports = {
  caminhoCatalogoLocal,
  gerarRobotsTxt,
  gerarSitemap,
  listarCatalogoLocal,
  montarMetadados,
  resolverCategoria,
  resolverLocalidade
};
