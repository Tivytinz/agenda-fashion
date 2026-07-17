const db = require("../db/db");

async function listarFavoritos(
  usuarioId
) {
  const resultado =
    await db.query(
      `
        SELECT
          n.id,
          n.nome,
          n.slug,
          n.foto_url,
          n.descricao,
          n.setor,
          n.cidade,
          n.estado,
          n.bairro,

          n.whatsapp
            AS whatsapp_negocio,

          n.localizacao_url,

          f.created_at
            AS favoritado_em

        FROM favoritos f

        INNER JOIN negocios n
          ON n.id = f.negocio_id

        WHERE f.usuario_id = $1
          AND n.ativo = TRUE

        ORDER BY
          f.created_at DESC,
          n.nome ASC
      `,
      [usuarioId]
    );

  return resultado.rows;
}

async function buscarNegocio(
  negocioId
) {
  const resultado =
    await db.query(
      `
        SELECT
          id,
          nome,
          slug,
          ativo,
          publicado

        FROM negocios

        WHERE id = $1
          AND ativo = TRUE

        LIMIT 1
      `,
      [negocioId]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

async function adicionarFavorito(
  usuarioId,
  negocioId
) {
  const resultado =
    await db.query(
      `
        INSERT INTO favoritos (
          usuario_id,
          negocio_id
        )
        VALUES (
          $1,
          $2
        )

        ON CONFLICT (
          usuario_id,
          negocio_id
        )
        DO NOTHING

        RETURNING
          id,
          usuario_id,
          negocio_id,
          created_at,
          updated_at
      `,
      [
        usuarioId,
        negocioId,
      ]
    );

  /*
   * Quando o favorito já existe,
   * ON CONFLICT retorna zero linhas.
   * Nesse caso, buscamos o registro
   * existente para manter uma resposta
   * previsível.
   */
  if (
    resultado.rows[0]
  ) {
    return resultado.rows[0];
  }

  const existente =
    await db.query(
      `
        SELECT
          id,
          usuario_id,
          negocio_id,
          created_at,
          updated_at

        FROM favoritos

        WHERE usuario_id = $1
          AND negocio_id = $2

        LIMIT 1
      `,
      [
        usuarioId,
        negocioId,
      ]
    );

  return (
    existente.rows[0] ||
    null
  );
}

async function removerFavorito(
  usuarioId,
  negocioId
) {
  const resultado =
    await db.query(
      `
        DELETE FROM favoritos

        WHERE usuario_id = $1
          AND negocio_id = $2

        RETURNING
          id,
          usuario_id,
          negocio_id
      `,
      [
        usuarioId,
        negocioId,
      ]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

async function verificarFavorito(
  usuarioId,
  negocioId
) {
  const resultado =
    await db.query(
      `
        SELECT EXISTS (
          SELECT 1

          FROM favoritos

          WHERE usuario_id = $1
            AND negocio_id = $2
        ) AS favoritado
      `,
      [
        usuarioId,
        negocioId,
      ]
    );

  return Boolean(
    resultado.rows[0]
      ?.favoritado
  );
}

module.exports = {
  listarFavoritos,
  buscarNegocio,
  adicionarFavorito,
  removerFavorito,
  verificarFavorito,
};