const db = require("../db/db");

async function listarNegociosPublicos() {
  const resultado = await db.query(`
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

      n.whatsapp AS whatsapp_negocio,
      n.whatsapp AS whatsapp,

      n.localizacao_url,
      n.localizacao_url AS google_maps_url,
      n.latitude,
      n.longitude,
      n.publicado,

      ARRAY[]::text[] AS areas,

      COALESCE(
        (
          SELECT
            jsonb_agg(
              jsonb_build_object(
                'id', s.id,
                'nome', s.nome,
                'descricao', s.descricao,
                'valor', s.valor,
                'duracao_minutos', s.duracao_minutos,
                'foto_url', s.foto_url
              )

              ORDER BY
                s.nome ASC
            )

          FROM servicos_negocio s

          WHERE s.negocio_id = n.id
            AND s.ativo = TRUE
        ),
        '[]'::jsonb
      ) AS servicos,

      COALESCE(
        (
          SELECT
            ROUND(
              AVG(a.avaliacao)::numeric,
              1
            )

          FROM agendamentos a

          WHERE a.negocio_id = n.id
            AND a.avaliacao IS NOT NULL
        ),
        0
      )::numeric(2, 1)
        AS media_avaliacoes,

      COALESCE(
        (
          SELECT
            COUNT(*)::int

          FROM agendamentos a

          WHERE a.negocio_id = n.id
            AND a.avaliacao IS NOT NULL
        ),
        0
      )::int
        AS total_avaliacoes

    FROM negocios n

    WHERE n.ativo = TRUE

    ORDER BY
      n.nome ASC
  `);

  return resultado.rows;
}

async function buscarNegocioPorSlug(
  slug
) {
  const resultado = await db.query(
    `
      SELECT
        n.id,
        n.nome,
        n.slug,
        n.foto_url,
        n.foto_public_id,
        n.descricao,
        n.setor,

        n.whatsapp
          AS whatsapp_negocio,
      n.whatsapp AS whatsapp,

        n.cidade,
        n.estado,
        n.bairro,
        n.endereco,
        n.numero,
        n.complemento,
        n.cep,
        n.localizacao_url,
      n.localizacao_url AS google_maps_url,
        n.latitude,
        n.longitude,
        n.fuso_horario,
        n.ativo,
        n.publicado,
        n.created_at,
        n.updated_at,

        ARRAY[]::text[]
          AS areas,

        (
          SELECT
            un.usuario_id

          FROM usuarios_negocios un

          WHERE un.negocio_id = n.id
            AND un.papel = 'dono'
            AND un.ativo = TRUE

          ORDER BY
            un.id ASC

          LIMIT 1
        ) AS dono_usuario_id,

        COALESCE(
          (
            SELECT
              ROUND(
                AVG(a.avaliacao)::numeric,
                1
              )

            FROM agendamentos a

            WHERE a.negocio_id = n.id
              AND a.avaliacao IS NOT NULL
          ),
          0
        )::numeric(2, 1)
          AS media_avaliacoes,

        COALESCE(
          (
            SELECT
              COUNT(*)::int

            FROM agendamentos a

            WHERE a.negocio_id = n.id
              AND a.avaliacao IS NOT NULL
          ),
          0
        )::int
          AS total_avaliacoes

      FROM negocios n

      WHERE n.slug = $1
        AND n.ativo = TRUE

      LIMIT 1
    `,
    [slug]
  );

  return resultado.rows[0] || null;
}

/*
 * A tabela negocios ainda não possui
 * uma coluna para armazenar visitas.
 *
 * Mantemos a função para preservar
 * compatibilidade com o service.
 */
async function incrementarVisita(
  negocioId
) {
  return Boolean(negocioId);
}

async function buscarServicos(
  negocioId
) {
  const resultado = await db.query(
    `
      SELECT
        id,
        nome,
        descricao,
        valor,
        duracao_minutos,
        foto_url

      FROM servicos_negocio

      WHERE negocio_id = $1
        AND ativo = TRUE

      ORDER BY
        nome ASC
    `,
    [negocioId]
  );

  return resultado.rows;
}

async function buscarProfissionais(
  negocioId
) {
  const resultado = await db.query(
    `
      SELECT
        u.id,
        u.nome,
        u.whatsapp,
        u.foto_url,
        un.papel

      FROM usuarios_negocios un

      INNER JOIN usuarios u
        ON u.id = un.usuario_id

      WHERE un.negocio_id = $1
        AND un.ativo = TRUE
        AND u.ativo = TRUE
        AND un.papel IN (
          'dono',
          'profissional'
        )

      ORDER BY
        CASE
          WHEN un.papel = 'dono'
            THEN 0
          ELSE 1
        END,

        u.nome ASC
    `,
    [negocioId]
  );

  return resultado.rows;
}

module.exports = {
  listarNegociosPublicos,
  buscarNegocioPorSlug,
  incrementarVisita,
  buscarServicos,
  buscarProfissionais,
};
