const db = require(
  "../db/db"
);
const servicosRepository = require(
  "./servicosRepository"
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
          n.publicacao_exige_agenda,

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

          EXISTS (
            SELECT 1
            FROM usuarios_negocios un
            INNER JOIN usuarios u
              ON u.id = un.usuario_id
            INNER JOIN agenda_configuracoes ac
              ON ac.profissional_id = un.usuario_id
            WHERE un.negocio_id = n.id
              AND un.ativo = TRUE
              AND u.ativo = TRUE
              AND un.papel IN (
                'dono',
                'profissional'
              )
              AND ac.configurado_em IS NOT NULL
          ) AS agenda_configurada,

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
  return db.executarTransacao(
    async (client) => {
      await client.query(
        `
          SELECT pg_advisory_xact_lock(
            hashtext($1)
          )
        `,
        [
          `negocio-slug:${dados.slug}`,
        ]
      );

      const atual =
        await client.query(
          `
            SELECT slug
            FROM negocios
            WHERE id = $1
            FOR UPDATE
          `,
          [negocioId]
        );

      if (!atual.rows[0]) {
        return null;
      }

      const conflito =
        await client.query(
          `
            SELECT 1
            FROM negocios
            WHERE slug = $1
              AND id <> $2

            UNION ALL

            SELECT 1
            FROM negocios_slugs_antigos
            WHERE slug = $1
              AND negocio_id <> $2

            LIMIT 1
          `,
          [dados.slug, negocioId]
        );

      if (conflito.rows[0]) {
        const erro = new Error(
          "Slug público indisponível."
        );
        erro.code =
          "SLUG_INDISPONIVEL";
        throw erro;
      }

      const slugAnterior =
        atual.rows[0].slug;

      if (
        slugAnterior !== dados.slug
      ) {
        await client.query(
          `
            DELETE FROM negocios_slugs_antigos
            WHERE negocio_id = $1
              AND slug = $2
          `,
          [negocioId, dados.slug]
        );

        await client.query(
          `
            INSERT INTO negocios_slugs_antigos (
              negocio_id,
              slug
            )
            VALUES ($1, $2)
            ON CONFLICT (slug) DO NOTHING
          `,
          [negocioId, slugAnterior]
        );
      }

      const resultado =
        await client.query(
      `
        UPDATE negocios

       SET
  nome = $1::TEXT,
  slug = $2::TEXT,
  foto_url = $3::TEXT,
  descricao = $4::TEXT,
  setor = $5::TEXT,
  cidade = $6::TEXT,
  estado = $7::TEXT,
  bairro = $8::TEXT,
  endereco = $9::TEXT,
  numero = $10::TEXT,
  complemento = $11::TEXT,
  cep = $12::TEXT,
  localizacao_url = $13::TEXT,
  whatsapp = $14::TEXT,
  areas = COALESCE(
    $15::TEXT[],
    ARRAY[]::TEXT[]
  ),
          updated_at = NOW()

        WHERE id = $16

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
          publicacao_exige_agenda,

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

          EXISTS (
            SELECT 1
            FROM usuarios_negocios un
            INNER JOIN usuarios u
              ON u.id = un.usuario_id
            INNER JOIN agenda_configuracoes ac
              ON ac.profissional_id = un.usuario_id
            WHERE un.negocio_id = negocios.id
              AND un.ativo = TRUE
              AND u.ativo = TRUE
              AND un.papel IN (
                'dono',
                'profissional'
              )
              AND ac.configurado_em IS NOT NULL
          ) AS agenda_configurada,

          created_at,
          updated_at
      `,
      [
        dados.nome,
        dados.slug,
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

      const negocioAtualizado =
        resultado.rows[0] ||
        null;

      if (!negocioAtualizado) {
        return null;
      }

      const publicacao =
        await servicosRepository
          .sincronizarPublicacaoAutomatica(
            negocioId,
            client
          );

      return {
        ...negocioAtualizado,
        publicado:
          publicacao?.publicado ??
          negocioAtualizado.publicado,
      };
    }
  );
}

async function atualizarPublicacao(
  negocioId,
  publicado
) {
  if (publicado === true) {
    return servicosRepository
      .sincronizarPublicacaoAutomatica(
        negocioId
      );
  }

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

async function atualizarFotoNegocio({
  negocioId,
  fotoUrl,
  fotoPublicId,
}) {
  const resultado =
    await db.query(
      `
        UPDATE negocios

        SET
          foto_url = $1,
          foto_public_id = $2,
          updated_at = NOW()

        WHERE id = $3

        RETURNING
          id,
          foto_url,
          foto_public_id,
          updated_at
      `,
      [
        fotoUrl,
        fotoPublicId,
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
  atualizarFotoNegocio,
  atualizarPublicacao,
};
