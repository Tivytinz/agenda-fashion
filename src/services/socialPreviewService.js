const fs = require("fs/promises");
const path = require("path");

const perfilNegocioRepository = require(
  "../repositories/perfilNegocioRepository"
);

const ORIGEM_PUBLICA_PADRAO =
  "https://app.agendafashion.com.br";

let htmlReactEmCache = null;

function origemPublica() {
  const valor = String(
    process.env.PUBLIC_APP_URL ||
      ORIGEM_PUBLICA_PADRAO
  ).trim();

  try {
    const url = new URL(valor);

    if (!["http:", "https:"].includes(url.protocol)) {
      return ORIGEM_PUBLICA_PADRAO;
    }

    return url.origin;
  } catch {
    return ORIGEM_PUBLICA_PADRAO;
  }
}

function textoSeguro(valor, limite = 180) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limite);
}

function escaparHtml(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function urlPublica(valor, origem) {
  if (!valor) return null;

  try {
    const url = new URL(String(valor), origem);

    return ["http:", "https:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function formatarPreco(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero < 0) {
    return null;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(numero);
}

function montarDescricao(negocio, servico) {
  if (servico) {
    const detalhes = [
      formatarPreco(servico.valor),
      Number(servico.duracao_minutos) > 0
        ? `${Number(servico.duracao_minutos)} min`
        : null
    ].filter(Boolean);

    const descricao = textoSeguro(
      servico.descricao,
      130
    );

    return textoSeguro(
      [
        descricao ||
          `Agende ${servico.nome} na ${negocio.nome}.`,
        detalhes.join(" • ")
      ].filter(Boolean).join(" "),
      180
    );
  }

  return textoSeguro(
    negocio.descricao ||
      `Conheça os serviços da ${negocio.nome} e agende seu horário online.`,
    180
  );
}

function montarMetadados({ negocio, servico }) {
  const origem = origemPublica();
  const url = new URL(
    `/negocio/${encodeURIComponent(negocio.slug)}`,
    origem
  );

  if (servico) {
    url.searchParams.set("servico", servico.id);
  }

  const titulo = textoSeguro(
    servico
      ? `${servico.nome} | ${negocio.nome}`
      : negocio.nome,
    90
  );

  const imagem = urlPublica(
    servico?.foto_url || negocio.foto_url,
    origem
  ) || `${origem}/social-preview.png`;

  return {
    titulo,
    descricao: montarDescricao(negocio, servico),
    imagem,
    url: url.href
  };
}

function tagMeta(propriedade, conteudo, tipo = "property") {
  return `<meta ${tipo}="${propriedade}" content="${escaparHtml(conteudo)}" />`;
}

function montarTags(metadados) {
  return [
    `<title>${escaparHtml(metadados.titulo)}</title>`,
    tagMeta("description", metadados.descricao, "name"),
    `<link rel="canonical" href="${escaparHtml(metadados.url)}" />`,
    tagMeta("og:locale", "pt_BR"),
    tagMeta("og:type", "website"),
    tagMeta("og:site_name", "Agenda Fashion"),
    tagMeta("og:title", metadados.titulo),
    tagMeta("og:description", metadados.descricao),
    tagMeta("og:url", metadados.url),
    tagMeta("og:image", metadados.imagem),
    tagMeta("og:image:alt", metadados.titulo),
    tagMeta("twitter:card", "summary_large_image", "name"),
    tagMeta("twitter:title", metadados.titulo, "name"),
    tagMeta("twitter:description", metadados.descricao, "name"),
    tagMeta("twitter:image", metadados.imagem, "name")
  ].join("\n    ");
}

async function lerHtmlReact() {
  if (htmlReactEmCache && process.env.NODE_ENV === "production") {
    return htmlReactEmCache;
  }

  const arquivo = path.join(
    process.cwd(),
    "agendamento-nails",
    "react-app",
    "index.html"
  );

  htmlReactEmCache = await fs.readFile(arquivo, "utf8");
  return htmlReactEmCache;
}

function injetarMetadados(html, metadados) {
  const tags = montarTags(metadados);
  const semMetadadosGenericos = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name=["']description["'][^>]*>/i, "")
    .replace(/\s*<!-- SOCIAL_META -->\s*/i, "\n    ");

  return semMetadadosGenericos.replace(
    /<\/head>/i,
    `    ${tags}\n  </head>`
  );
}

async function buscarPrevia({ slug, servicoId }) {
  const slugSolicitado = textoSeguro(slug, 120).toLowerCase();
  const negocio =
    await perfilNegocioRepository.buscarNegocioPorSlug(
      slugSolicitado
    );

  if (!negocio) return null;

  const servicos =
    await perfilNegocioRepository.buscarServicos(negocio.id);

  const servico = servicos.find(
    item => String(item.id) === String(servicoId || "")
  ) || null;

  return {
    negocio,
    servico,
    slugSolicitado,
    metadados: montarMetadados({ negocio, servico })
  };
}

module.exports = {
  buscarPrevia,
  escaparHtml,
  injetarMetadados,
  lerHtmlReact,
  montarMetadados,
  origemPublica
};
