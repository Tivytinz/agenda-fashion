const db = require(
  "../db/db"
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

    const resultado =
      await db.query(
        `
          SELECT
            ua.usuario_id,
            ua.papel

          FROM usuarios_administradores ua

          INNER JOIN usuarios u
            ON u.id = ua.usuario_id

          WHERE ua.usuario_id = $1
            AND ua.ativo = TRUE
            AND u.ativo = TRUE
            AND ua.papel IN (
              'admin',
              'superadmin'
            )

          LIMIT 1
        `,
        [
          usuarioId,
        ]
      );

    const administrador =
      resultado.rows[0] ||
      null;

    if (!administrador) {
      throw new AppError(
        "Acesso restrito aos administradores da plataforma.",
        403
      );
    }

    /*
     * A permissão administrativa não é
     * inserida no JWT nem em usuario.tipo.
     *
     * Ela existe somente durante esta
     * requisição após a consulta ao banco.
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