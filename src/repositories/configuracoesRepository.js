const db = require(
  "../db/db"
);

/*
 * Busca o vínculo do usuário com um negócio.
 *
 * Caso o usuário tenha mais de um vínculo,
 * prioriza aquele em que ele é dono.
 */
async function buscarNegocioDoUsuario(
  usuarioId
) {
  const resultado =
    await db.query(
      `
        SELECT
          un.negocio_id,
          un.papel

        FROM usuarios_negocios un

        WHERE un.usuario_id = $1

        ORDER BY
          CASE
            WHEN un.papel = 'dono'
              THEN 0
            ELSE 1
          END,
          un.negocio_id ASC

        LIMIT 1
      `,
      [usuarioId]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

/*
 * No banco, a coluna atual é "whatsapp".
 *
 * O alias "whatsapp_negocio" é mantido
 * temporariamente para compatibilidade com
 * o frontend e com o service de configurações.
 */
async function buscarNegocioPorId(
  negocioId
) {
  const resultado =
    await db.query(
      `
        SELECT
          n.id,
          n.id AS negocio_id,

          n.nome,
          n.nome AS nome_negocio,

          n.slug,

          n.foto_url,
          n.foto_public_id,

          n.descricao,
          n.setor,

          n.cidade,
          n.bairro,
          n.localizacao_url,

          n.whatsapp,
          n.whatsapp
            AS whatsapp_negocio,

          COALESCE(
            n.areas,
            ARRAY[]::TEXT[]
          ) AS areas,

          n.created_at,
          n.updated_at

        FROM negocios n

        WHERE n.id = $1

        LIMIT 1
      `,
      [negocioId]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

async function atualizarNegocio(
  negocioId,
  dados
) {
  const resultado =
    await db.query(
      `
        UPDATE negocios

        SET
          nome = $1,
          foto_url = $2,
          descricao = $3,
          setor = $4,
          cidade = $5,
          bairro = $6,
          localizacao_url = $7,
          whatsapp = $8,
          areas = COALESCE(
            $9::TEXT[],
            ARRAY[]::TEXT[]
          ),
          updated_at = NOW()

        WHERE id = $10

        RETURNING
          id,
          id AS negocio_id,

          nome,
          nome AS nome_negocio,

          slug,

          foto_url,
          foto_public_id,

          descricao,
          setor,

          cidade,
          bairro,
          localizacao_url,

          whatsapp,
          whatsapp
            AS whatsapp_negocio,

          COALESCE(
            areas,
            ARRAY[]::TEXT[]
          ) AS areas,

          created_at,
          updated_at
      `,
      [
        dados.nome,
        dados.foto_url,
        dados.descricao,
        dados.setor,
        dados.cidade,
        dados.bairro,
        dados.localizacao_url,
        dados.whatsapp_negocio,
        dados.areas,
        negocioId,
      ]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

module.exports = {
  buscarNegocioDoUsuario,
  buscarNegocioPorId,
  atualizarNegocio,
};