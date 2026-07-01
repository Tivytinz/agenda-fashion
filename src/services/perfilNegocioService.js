const perfilNegocioRepository = require("../repositories/perfilNegocioRepository");

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

async function listarNegociosPublicos() {
  const negocios =
    await perfilNegocioRepository.listarNegociosPublicos();

  return {
    negocios: negocios.map(negocio => ({
      ...negocio,
      areas: normalizarAreas(negocio.areas)
    }))
  };
}

async function buscarPerfilPublico({ slug }) {
  if (!slug) {
    throw new Error("Slug do negócio não informado.");
  }

  const negocio =
    await perfilNegocioRepository.buscarNegocioPorSlug(slug);

  if (!negocio) {
    throw new Error("Negócio não encontrado.");
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