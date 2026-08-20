const db = require(
  "../db/db"
);

const PERFIS_CTE = `
  WITH candidatos AS (
    SELECT
      u.id AS usuario_id,
      u.nome AS usuario_nome,
      u.email,
      u.whatsapp AS usuario_whatsapp,
      u.created_at AS cadastro_em,
      u.ultimo_login_em,
      mua.utm_source,
      mua.utm_campaign,
      n.id AS negocio_id,
      n.nome AS negocio_nome,
      n.slug AS negocio_slug,
      n.descricao,
      n.areas,
      n.setor,
      n.whatsapp AS negocio_whatsapp,
      n.cidade,
      n.estado,
      COALESCE(n.publicado, FALSE) AS publicado,
      COALESCE(servico.possui_servico_ativo, FALSE)
        AS possui_servico_ativo,
      ac.configurado_em,
      GREATEST(
        u.updated_at,
        COALESCE(u.ultimo_login_em, u.created_at),
        COALESCE(n.updated_at, u.created_at),
        COALESCE(servico.atualizado_em, u.created_at),
        COALESCE(ac.updated_at, u.created_at)
      ) AS ultima_atividade_em
    FROM usuarios u
    INNER JOIN marketing_usuario_atribuicoes mua
      ON mua.usuario_id = u.id
      AND mua.intencao = 'profissional'
    LEFT JOIN LATERAL (
      SELECT un.negocio_id
      FROM usuarios_negocios un
      WHERE un.usuario_id = u.id
        AND un.papel = 'dono'
        AND un.ativo = TRUE
      ORDER BY un.created_at ASC, un.id ASC
      LIMIT 1
    ) dono ON TRUE
    LEFT JOIN negocios n
      ON n.id = dono.negocio_id
      AND n.ativo = TRUE
    LEFT JOIN LATERAL (
      SELECT
        BOOL_OR(s.ativo) AS possui_servico_ativo,
        MAX(s.updated_at) AS atualizado_em
      FROM servicos_negocio s
      WHERE s.negocio_id = n.id
    ) servico ON TRUE
    LEFT JOIN agenda_configuracoes ac
      ON ac.profissional_id = u.id
    WHERE u.ativo = TRUE
      AND NOT EXISTS (
        SELECT 1
        FROM usuarios_administradores ua
        WHERE ua.usuario_id = u.id
          AND ua.ativo = TRUE
      )
  ),
  avaliados AS (
    SELECT
      candidatos.*,
      negocio_id IS NOT NULL AS tem_negocio,
      NULLIF(BTRIM(descricao), '') IS NOT NULL
        AS descricao_preenchida,
      (
        negocio_id IS NOT NULL
        AND (
          CARDINALITY(COALESCE(areas, ARRAY[]::TEXT[])) > 0
          OR NULLIF(BTRIM(setor), '') IS NOT NULL
        )
        AND COALESCE(
          negocio_whatsapp ~ '^[0-9]{10,11}$',
          FALSE
        )
        AND NULLIF(BTRIM(cidade), '') IS NOT NULL
        AND estado IN (
          'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF',
          'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
          'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS',
          'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
        )
      ) AS perfil_basico_completo,
      configurado_em IS NOT NULL AS agenda_configurada,
      (
        (negocio_id IS NOT NULL)::INT
        + (
          negocio_id IS NOT NULL
          AND (
            CARDINALITY(COALESCE(areas, ARRAY[]::TEXT[])) > 0
            OR NULLIF(BTRIM(setor), '') IS NOT NULL
          )
          AND COALESCE(
            negocio_whatsapp ~ '^[0-9]{10,11}$',
            FALSE
          )
          AND NULLIF(BTRIM(cidade), '') IS NOT NULL
          AND estado IN (
            'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF',
            'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
            'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS',
            'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
          )
        )::INT
        + possui_servico_ativo::INT
        + (configurado_em IS NOT NULL)::INT
        + publicado::INT
      ) AS etapas_concluidas
    FROM candidatos
  )
`;

async function buscarResumo() {
  const resultado =
    await db.query(
      `
        ${PERFIS_CTE}
        SELECT
          COUNT(*)::INT AS total_profissionais,
          COUNT(*) FILTER (
            WHERE etapas_concluidas < 5
              OR descricao_preenchida = FALSE
          )::INT AS total_incompletos,
          COUNT(*) FILTER (
            WHERE tem_negocio = FALSE
          )::INT AS sem_negocio,
          COUNT(*) FILTER (
            WHERE tem_negocio = TRUE
              AND perfil_basico_completo = FALSE
          )::INT AS perfil_incompleto,
          COUNT(*) FILTER (
            WHERE tem_negocio = TRUE
              AND descricao_preenchida = FALSE
          )::INT AS sem_descricao,
          COUNT(*) FILTER (
            WHERE tem_negocio = TRUE
              AND possui_servico_ativo = FALSE
          )::INT AS sem_servico,
          COUNT(*) FILTER (
            WHERE tem_negocio = TRUE
              AND agenda_configurada = FALSE
          )::INT AS sem_agenda,
          COUNT(*) FILTER (
            WHERE tem_negocio = TRUE
              AND publicado = FALSE
          )::INT AS nao_publicados,
          COUNT(*) FILTER (
            WHERE etapas_concluidas = 5
              AND descricao_preenchida = TRUE
          )::INT AS completos
        FROM avaliados
      `
    );

  return resultado.rows[0] || {};
}

function filtroPendenciaSql(
  pendencia
) {
  const filtros = {
    sem_negocio:
      "AND tem_negocio = FALSE",
    perfil:
      "AND tem_negocio = TRUE AND perfil_basico_completo = FALSE",
    descricao:
      "AND tem_negocio = TRUE AND descricao_preenchida = FALSE",
    servico:
      "AND tem_negocio = TRUE AND possui_servico_ativo = FALSE",
    agenda:
      "AND tem_negocio = TRUE AND agenda_configurada = FALSE",
    publicacao:
      "AND tem_negocio = TRUE AND publicado = FALSE",
  };

  return filtros[pendencia] || "";
}

async function listarPerfisIncompletos({
  busca = "",
  pendencia = "todos",
  limite = 25,
  offset = 0,
}) {
  const resultado =
    await db.query(
      `
        ${PERFIS_CTE}
        SELECT
          usuario_id,
          usuario_nome,
          email,
          usuario_whatsapp,
          cadastro_em,
          ultimo_login_em,
          utm_source,
          utm_campaign,
          negocio_id,
          negocio_nome,
          negocio_slug,
          descricao,
          areas,
          setor,
          negocio_whatsapp,
          cidade,
          estado,
          publicado,
          possui_servico_ativo,
          configurado_em,
          ultima_atividade_em,
          tem_negocio,
          descricao_preenchida,
          perfil_basico_completo,
          agenda_configurada,
          etapas_concluidas,
          COUNT(*) OVER()::INT AS total_resultados
        FROM avaliados
        WHERE (
          etapas_concluidas < 5
          OR descricao_preenchida = FALSE
        )
          AND (
            $1 = ''
            OR usuario_nome ILIKE '%' || $1 || '%'
            OR email ILIKE '%' || $1 || '%'
            OR COALESCE(usuario_whatsapp, '') ILIKE '%' || $1 || '%'
            OR COALESCE(negocio_nome, '') ILIKE '%' || $1 || '%'
          )
          ${filtroPendenciaSql(pendencia)}
        ORDER BY
          (etapas_concluidas = 5) ASC,
          etapas_concluidas DESC,
          ultima_atividade_em DESC,
          cadastro_em DESC,
          usuario_id DESC
        LIMIT $2
        OFFSET $3
      `,
      [
        busca,
        limite,
        offset,
      ]
    );

  return resultado.rows;
}

module.exports = {
  buscarResumo,
  listarPerfisIncompletos,
};
