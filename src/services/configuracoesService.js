const configuracoesRepository = require("../repositories/configuracoesRepository");

const {
  exigirUsuario,
  exigirRecurso
} = require("../validators/commonValidator");

function normalizarAreas(areas) {
  if (!areas) return [];

  if (Array.isArray(areas)) {
    return areas;
  }

  if (typeof areas === "string") {
    try {
      const parsed = JSON.parse(areas);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return areas
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

async function buscarConfiguracoes({ usuarioId }) {
  exigirUsuario(usuarioId);

  const negocioUsuario =
    await configuracoesRepository.buscarNegocioDoUsuario(usuarioId);

  exigirRecurso(
    negocioUsuario,
    "Usuário não está vinculado a nenhum negócio."
  );

  const negocio =
    await configuracoesRepository.buscarNegocioPorId(
      negocioUsuario.negocio_id
    );

  exigirRecurso(negocio, "Negócio não encontrado.");

  const negocioNormalizado = {
    ...negocio,
    areas: normalizarAreas(negocio.areas)
  };

  return {
    negocio: negocioNormalizado,
    configuracoes: negocioNormalizado
  };
}

async function salvarConfiguracoes({ usuarioId, dados }) {
  exigirUsuario(usuarioId);

  const negocioUsuario =
    await configuracoesRepository.buscarNegocioDoUsuario(usuarioId);

  exigirRecurso(
    negocioUsuario,
    "Usuário não está vinculado a nenhum negócio."
  );

  if (negocioUsuario.papel !== "dono") {
    const ForbiddenError = require("../errors/ForbiddenError");
    throw new ForbiddenError("Apenas o dono pode editar o negócio.");
  }

  const negocioAtual =
    await configuracoesRepository.buscarNegocioPorId(
      negocioUsuario.negocio_id
    );

  exigirRecurso(negocioAtual, "Negócio não encontrado.");

  const areasFinal = normalizarAreas(
    dados.areas !== undefined
      ? dados.areas
      : negocioAtual.areas
  );

  const negocioAtualizado =
    await configuracoesRepository.atualizarNegocio(
      negocioUsuario.negocio_id,
      {
        nome: dados.nome !== undefined ? dados.nome : negocioAtual.nome,
        foto_url: dados.foto_url !== undefined ? dados.foto_url : negocioAtual.foto_url,
        descricao: dados.descricao !== undefined ? dados.descricao : negocioAtual.descricao,
        setor: dados.setor !== undefined ? dados.setor : negocioAtual.setor,
        cidade: dados.cidade !== undefined ? dados.cidade : negocioAtual.cidade,
        bairro: dados.bairro !== undefined ? dados.bairro : negocioAtual.bairro,
        localizacao_url: dados.localizacao_url !== undefined ? dados.localizacao_url : negocioAtual.localizacao_url,
        whatsapp_negocio: dados.whatsapp_negocio !== undefined ? dados.whatsapp_negocio : negocioAtual.whatsapp_negocio,
        areas: areasFinal
      }
    );

  const negocioNormalizado = {
    ...negocioAtualizado,
    areas: normalizarAreas(negocioAtualizado.areas),
    papel: negocioUsuario.papel
  };

  return {
    mensagem: "Configurações salvas com sucesso.",
    negocio: negocioNormalizado,
    configuracoes: {
      ...negocioAtualizado,
      areas: normalizarAreas(negocioAtualizado.areas)
    }
  };
}

module.exports = {
  buscarConfiguracoes,
  salvarConfiguracoes
};