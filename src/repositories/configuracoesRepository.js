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
        INNER JOIN usuarios u
          ON u.id = un.usuario_id
        INNER JOIN negocios n
          ON n.id = un.negocio_id

        WHERE un.usuario_id = $1
          AND un.ativo = TRUE
          AND u.ativo = TRUE
          AND n.ativo = TRUE

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

          n.publicado,

          n.cidade,
          n.estado,
          n.bairro,
          n.endereco,
          n.numero,
          n.complemento,
          n.cep,
          n.localizacao_url,

          n.whatsapp,
          n.whatsapp
            AS whatsapp_negocio,

          COALESCE(
            n.areas,
            ARRAY[]::TEXT[]
          ) AS areas,

          EXISTS (
            SELECT 1
            FROM servicos_negocio s
            WHERE s.negocio_id = n.id
              AND s.ativo = TRUE
          ) AS possui_servico_ativo,

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
          estado = $6,
          bairro = $7,
          endereco = $8,
          numero = $9,
          complemento = $10,
          cep = $11,
          localizacao_url = $12,
          whatsapp = $13,
          areas = COALESCE(
            $14::TEXT[],
            ARRAY[]::TEXT[]
          ),
          publicado = CASE
            WHEN negocios.publicado = TRUE
              AND NULLIF(BTRIM(COALESCE($3, '')), '') IS NOT NULL
              AND NULLIF(BTRIM(COALESCE($4, '')), '') IS NOT NULL
              AND NULLIF(BTRIM(COALESCE($5, '')), '') IS NOT NULL
              AND NULLIF(BTRIM(COALESCE($6, '')), '') IS NOT NULL
              AND NULLIF(BTRIM(COALESCE($13, '')), '') IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM servicos_negocio s
                WHERE s.negocio_id = negocios.id
                  AND s.ativo = TRUE
              )
            THEN TRUE
            ELSE FALSE
          END,
          updated_at = NOW()

        WHERE id = $15

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

          publicado,

          cidade,
          estado,
          bairro,
          endereco,
          numero,
          complemento,
          cep,
          localizacao_url,

          whatsapp,
          whatsapp
            AS whatsapp_negocio,

          COALESCE(
            areas,
            ARRAY[]::TEXT[]
          ) AS areas,

          EXISTS (
            SELECT 1
            FROM servicos_negocio s
            WHERE s.negocio_id = negocios.id
              AND s.ativo = TRUE
          ) AS possui_servico_ativo,

          created_at,
          updated_at
      `,
      [
        dados.nome,
        dados.foto_url,
        dados.descricao,
        dados.setor,
        dados.cidade,
        dados.estado,
        dados.bairro,
        dados.endereco,
        dados.numero,
        dados.complemento,
        dados.cep,
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

async function atualizarPublicacao(
  negocioId,
  publicado
) {
  const resultado =
    await db.query(
      `
        UPDATE negocios

        SET
          publicado = $1,
          updated_at = NOW()

        WHERE id = $2

        RETURNING id, publicado
      `,
      [
        publicado,
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
  atualizarPublicacao,
};
