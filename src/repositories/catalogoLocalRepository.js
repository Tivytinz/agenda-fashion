const db = require("../db/db");

const CIDADE_SLUG_SQL = `
  trim(
    both '-' from regexp_replace(
      regexp_replace(
        regexp_replace(
          translate(
            lower(btrim(n.cidade)),
            'áàâãäéèêëíìîïóòôõöúùûüç',
            'aaaaaeeeeiiiiooooouuuuc'
          ),
          '[[:space:]]+',
          '-',
          'g'
        ),
        '[^a-z0-9-]',
        '',
        'g'
      ),
      '-+',
      '-',
      'g'
    )
  )
`;

async function buscarLocalidadePublica({
  cidadeSlug,
  estado
}) {
  const resultado = await db.query(
    `
      SELECT
        n.cidade,
        n.estado,
        COUNT(*)::int AS total_negocios
      FROM negocios n
      WHERE n.ativo = TRUE
        AND n.publicado = TRUE
        AND n.cidade IS NOT NULL
        AND btrim(n.cidade) <> ''
        AND n.estado IS NOT NULL
        AND ${CIDADE_SLUG_SQL} = $1
        AND upper(n.estado) = upper($2)
      GROUP BY n.cidade, n.estado
      ORDER BY COUNT(*) DESC, n.cidade ASC
      LIMIT 1
    `,
    [cidadeSlug, estado]
  );

  return resultado.rows[0] || null;
}

async function listarEntradasSitemap() {
  const resultado = await db.query(`
    SELECT
      n.slug,
      n.cidade,
      n.estado,
      n.updated_at,
      s.categoria
    FROM negocios n
    LEFT JOIN servicos_negocio s
      ON s.negocio_id = n.id
      AND s.ativo = TRUE
    WHERE n.ativo = TRUE
      AND n.publicado = TRUE
    ORDER BY n.id ASC, s.id ASC
  `);

  return resultado.rows;
}

module.exports = {
  buscarLocalidadePublica,
  listarEntradasSitemap
};
