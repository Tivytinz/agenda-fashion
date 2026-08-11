const sessaoRepository = require(
  "../repositories/sessaoRepository"
);

const AppError = require(
  "../errors/AppError"
);

function normalizarUsuarioId(
  valor
) {
  const usuarioId =
    Number(valor);

  if (
    !Number.isInteger(
      usuarioId
    ) ||
    usuarioId <= 0
  ) {
    return null;
  }

  return usuarioId;
}

async function authAdmin(
  req,
  res,
  next
) {
  try {
    /*
     * Este middleware deve ser executado
     * depois do middleware auth.
     *
     * O JWT contém somente:
     * { id: usuarioId }
     */
    const usuarioId =
      normalizarUsuarioId(
        req.user?.id
      );

    if (!usuarioId) {
      throw new AppError(
        "Usuário não autenticado.",
        401
      );
    }

    const administrador =
      await sessaoRepository
        .buscarAdministradorAtivoPorUsuarioId(
          usuarioId
        );

    if (!administrador) {
      throw new AppError(
        "Acesso restrito aos administradores da plataforma.",
        403
      );
    }

    /*
     * A permissão administrativa não é
     * inserida no JWT.
     *
     * Ela é consultada no banco em cada
     * requisição administrativa.
     */
    req.admin = {
      usuarioId:
        Number(
          administrador.usuario_id
        ),

      papel:
        administrador.papel,

      superadmin:
        administrador.papel ===
        "superadmin",
    };

    return next();
  } catch (erro) {
    return next(erro);
  }
}

module.exports =
  authAdmin;