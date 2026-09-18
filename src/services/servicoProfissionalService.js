const db = require("../db/db");
const servicoProfissionalRepository = require(
  "../repositories/servicoProfissionalRepository"
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

  if (valor.length > 200) {
    throw criarErro(
      "A lista de serviços excede o limite permitido.",
      400
    );
  }

  const ids = valor.map(normalizarId);

  if (ids.some((id) => !id)) {
    throw criarErro(
      "Existe um serviço inválido na seleção.",
      400
    );
  }

  return [...new Set(ids)];
}

async function resolverContextoDono({
  usuarioId,
  profissionalId,
  executor = db,
}) {
  const usuario = normalizarId(usuarioId);
  const profissional =
    normalizarId(profissionalId);

  if (!usuario) {
    throw criarErro(
      "Usuário não autenticado.",
      401
    );
  }

  if (!profissional) {
    throw criarErro(
      "Profissional inválida.",
      400
    );
  }

  const dono =
    await servicoProfissionalRepository
      .buscarNegocioDono(
        usuario,
        executor
      );

  if (!dono?.negocio_id) {
    throw criarErro(
      "Apenas a proprietária pode configurar os serviços da equipe.",
      403
    );
  }

  const vinculo =
    await servicoProfissionalRepository
      .buscarProfissionalAtivo(
        {
          negocioId:
            dono.negocio_id,
          profissionalId:
            profissional,
        },
        executor
      );

  if (!vinculo) {
    throw criarErro(
      "Profissional ativa não encontrada neste negócio.",
      404
    );
  }

  return {
    usuarioId: usuario,
    negocioId:
      Number(dono.negocio_id),
    profissionalId:
      profissional,
    profissional:
      vinculo,
  };
}

async function listarServicosProfissional({
  usuarioId,
  profissionalId,
}) {
  const contexto =
    await resolverContextoDono({
      usuarioId,
      profissionalId,
    });

  const servicos =
    await servicoProfissionalRepository
      .listarServicosComElegibilidade({
        negocioId:
          contexto.negocioId,
        profissionalId:
          contexto.profissionalId,
      });

  return {
    profissional:
      contexto.profissional,
    servicos,
  };
}

async function configurarServicosProfissional({
  usuarioId,
  profissionalId,
  servicoIds,
}) {
  const ids =
    normalizarServicoIds(
      servicoIds
    );

  return db.executarTransacao(
    async (client) => {
      const contexto =
        await resolverContextoDono({
          usuarioId,
          profissionalId,
          executor:
            client,
        });

      const servicos =
        await servicoProfissionalRepository
          .listarServicosComElegibilidade(
            {
              negocioId:
                contexto.negocioId,
              profissionalId:
                contexto.profissionalId,
            },
            client
          );

      const permitidos =
        new Set(
          servicos.map(
            (item) => Number(item.id)
          )
        );

      if (
        ids.some(
          (id) => !permitidos.has(id)
        )
      ) {
        throw criarErro(
          "Um ou mais serviços não pertencem a este negócio.",
          400
        );
      }

      const salvos =
        await servicoProfissionalRepository
          .substituirElegibilidade({
            negocioId:
              contexto.negocioId,
            profissionalId:
              contexto.profissionalId,
            servicoIds:
              ids,
            actorUserId:
              contexto.usuarioId,
            executor:
              client,
          });

      if (salvos.length !== ids.length) {
        throw criarErro(
          "Não foi possível salvar toda a configuração de serviços.",
          409
        );
      }

      const atualizados =
        await servicoProfissionalRepository
          .listarServicosComElegibilidade(
            {
              negocioId:
                contexto.negocioId,
              profissionalId:
                contexto.profissionalId,
            },
            client
          );

      return {
        mensagem:
          "Serviços da profissional atualizados.",
        profissional:
          contexto.profissional,
        servicos:
          atualizados,
      };
    }
  );
}

module.exports = {
  listarServicosProfissional,
  configurarServicosProfissional,
  normalizarServicoIds,
};
