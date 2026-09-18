const db = require("../db/db");
const profissionaisRepository = require(
  "../repositories/profissionaisRepository"
);
const profissionalServicosRepository = require(
  "../repositories/profissionalServicosRepository"
);

function criarErro(mensagem, statusCode) {
  const erro = new Error(mensagem);
  erro.status = statusCode;
  erro.statusCode = statusCode;
  return erro;
}

function normalizarId(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function normalizarServicoIds(valor) {
  if (!Array.isArray(valor)) {
    throw criarErro(
      "Informe a lista de serviços da profissional.",
      400
    );
  }

  const ids = valor.map(Number);

  if (
    ids.some(
      (id) =>
        !Number.isInteger(id) ||
        id <= 0
    )
  ) {
    throw criarErro(
      "A lista de serviços contém identificadores inválidos.",
      400
    );
  }

  return Array.from(new Set(ids));
}

async function obterContextoDono(usuarioId) {
  const dono =
    await profissionaisRepository
      .buscarNegocioDono(usuarioId);

  if (!dono?.negocio_id) {
    throw criarErro(
      "Apenas a proprietária pode configurar os serviços da equipe.",
      403
    );
  }

  return dono;
}

async function listarServicosProfissional({
  usuarioId,
  profissionalId,
}) {
  const profissional =
    normalizarId(profissionalId);

  if (!profissional) {
    throw criarErro(
      "Profissional inválida.",
      400
    );
  }

  const dono =
    await obterContextoDono(usuarioId);

  const vinculo =
    await profissionalServicosRepository
      .buscarVinculoAtivoProfissional({
        negocioId:
          dono.negocio_id,
        profissionalId:
          profissional,
      });

  if (!vinculo) {
    throw criarErro(
      "Profissional não encontrada na equipe ativa.",
      404
    );
  }

  const servicos =
    await profissionalServicosRepository
      .listarServicosProfissional({
        negocioId:
          dono.negocio_id,
        profissionalId:
          profissional,
      });

  return {
    profissional_id:
      profissional,
    servicos,
  };
}

async function atualizarServicosProfissional({
  usuarioId,
  profissionalId,
  servicoIds,
}) {
  const profissional =
    normalizarId(profissionalId);

  if (!profissional) {
    throw criarErro(
      "Profissional inválida.",
      400
    );
  }

  const ids =
    normalizarServicoIds(
      servicoIds
    );

  const dono =
    await obterContextoDono(usuarioId);

  const resultado =
    await db.executarTransacao(
      async (client) => {
        await profissionalServicosRepository
          .bloquearElegibilidadeNegocio({
            negocioId:
              dono.negocio_id,
            executor:
              client,
          });

        const vinculo =
          await profissionalServicosRepository
            .buscarVinculoAtivoProfissional({
              negocioId:
                dono.negocio_id,
              profissionalId:
                profissional,
              executor:
                client,
              bloquear:
                true,
            });

        if (!vinculo) {
          throw criarErro(
            "Profissional não encontrada na equipe ativa.",
            404
          );
        }

        await profissionalServicosRepository
          .substituirServicosProfissional({
            negocioId:
              dono.negocio_id,
            profissionalId:
              profissional,
            servicoIds:
              ids,
            habilitadoPorUsuarioId:
              Number(usuarioId),
            executor:
              client,
          });

        return profissionalServicosRepository
          .listarServicosProfissional({
            negocioId:
              dono.negocio_id,
            profissionalId:
              profissional,
            executor:
              client,
          });
      }
    );

  return {
    mensagem:
      "Serviços da profissional atualizados.",
    profissional_id:
      profissional,
    servicos:
      resultado,
  };
}

module.exports = {
  listarServicosProfissional,
  atualizarServicosProfissional,
};
