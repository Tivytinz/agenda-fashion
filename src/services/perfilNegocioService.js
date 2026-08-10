const perfilNegocioRepository = require("../repositories/perfilNegocioRepository");
const AppError = require("../errors/AppError");
const {
  CATEGORIAS_CATALOGO,
  termosDaCategoria
} = require("../domain/catalogoCategorias");

function normalizarAreas(valor) {
  if (!valor) return [];

  if (Array.isArray(valor)) {
    return valor;
  }

  if (typeof valor === "string") {
    try {
      const parsed = JSON.parse(valor);

      return Array.isArray(parsed)
        ? parsed
        : [];
    } catch {
      return valor
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function normalizarInteiro(valor, padrao, maximo) {
  const numero = Number.parseInt(valor, 10);

  if (!Number.isFinite(numero) || numero < 1) {
    return padrao;
  }

  return Math.min(numero, maximo);
}

function normalizarBusca(valor) {
  return String(valor || "")
    .trim()
    .slice(0, 120);
}

async function listarNegociosPublicos({
  busca,
  categoria,
  pagina,
  limite
} = {}) {
  const paginaNormalizada =
    normalizarInteiro(pagina, 1, 100000);

  const limiteNormalizado =
    normalizarInteiro(limite, 12, 24);

  const buscaNormalizada =
    normalizarBusca(busca);

  const categoriaNormalizada =
    normalizarBusca(categoria);

  const categoriaTermos =
    termosDaCategoria(categoriaNormalizada);

  const negocios =
    await perfilNegocioRepository.listarNegociosPublicos({
      busca: buscaNormalizada,
      categoria: Object.hasOwn(CATEGORIAS_CATALOGO, categoriaNormalizada)
        ? categoriaNormalizada
        : "",
      categoriaTermos,
      limite: limiteNormalizado,
      offset:
        (paginaNormalizada - 1) *
        limiteNormalizado
    });

  const total = Number(
    negocios[0]?.total_resultados || 0
  );

  return {
    negocios: negocios.map(negocio => ({
      ...Object.fromEntries(
        Object.entries(negocio).filter(
          ([chave]) =>
            chave !== "total_resultados"
        )
      ),
      areas: normalizarAreas(negocio.areas),
      servicos: Array.isArray(negocio.servicos)
        ? negocio.servicos
        : []
    })),
    paginacao: {
      pagina: paginaNormalizada,
      limite: limiteNormalizado,
      total,
      tem_mais:
        paginaNormalizada *
          limiteNormalizado <
        total
    }
  };
}

async function buscarPerfilPublico({ slug }) {
  if (!slug) {
    throw new Error("Slug do negócio não informado.");
  }

  const slugSolicitado = String(slug)
    .trim()
    .toLowerCase();

  const negocio =
    await perfilNegocioRepository.buscarNegocioPorSlug(slugSolicitado);

  if (!negocio) {
    throw new AppError("Negócio não encontrado.", 404);
  }

  await perfilNegocioRepository.incrementarVisita(
    negocio.id
  );

  const servicos =
    await perfilNegocioRepository.buscarServicos(
      negocio.id
    );

  const profissionais =
    await perfilNegocioRepository.buscarProfissionais(
      negocio.id
    );

  return {
    redirecionamento: negocio.slug !== slugSolicitado
      ? {
          slug: negocio.slug
        }
      : null,
    negocio: {
      ...negocio,
      areas: normalizarAreas(negocio.areas)
    },
    servicos,
    profissionais
  };
}

module.exports = {
  listarNegociosPublicos,
  buscarPerfilPublico
};
