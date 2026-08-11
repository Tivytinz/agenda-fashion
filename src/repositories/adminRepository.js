const db = require(
  "../db/db"
);

const PERIODOS_PERMITIDOS =
  new Set([
    "all",
    "today",
    "7",
    "30",
    "month",
  ]);

function normalizarPeriodo(
  valor
) {
  const periodo =
    String(
      valor || "all"
    ).trim();

  return PERIODOS_PERMITIDOS.has(
    periodo
  )
    ? periodo
    : "all";
}

/*
 * Os filtros são escolhidos em uma lista
 * fixa e nunca são montados diretamente
 * com um valor enviado pelo usuário.
 */
function filtroPeriodo(
  periodo,
  alias
) {
  const periodoNormalizado =
    normalizarPeriodo(
      periodo
    );

  const prefixo =
    alias
      ? `${alias}.`
      : "";

  const filtros = {
    all:
      "",

    today:
      `AND ${prefixo}created_at >= CURRENT_DATE`,

    "7":
      `AND ${prefixo}created_at >= NOW() - INTERVAL '7 days'`,

    "30":
      `AND ${prefixo}created_at >= NOW() - INTERVAL '30 days'`,

    month:
      `AND DATE_TRUNC(
        'month',
        ${prefixo}created_at
      ) = DATE_TRUNC(
        'month',
        NOW()
      )`,
  };

  return filtros[
    periodoNormalizado
  ];
}

function converterTotal(
  resultado,
  campo = "total"
) {
  return Number(
    resultado?.rows?.[0]?.[
      campo
    ] || 0
  );
}

/*
 * Recursos de métricas como visitas e
 * cliques existiam no projeto antigo,
 * mas podem ainda não existir em todos
 * os bancos.
 *
 * Somente erros de tabela ou coluna
 * inexistente recebem fallback.
 * Outros erros continuam sendo lançados.
 */
async function executarConsultaOpcional(
  sql,
  parametros = [],
  rowsFallback = []
) {
  try {
    return await db.query(
      sql,
      parametros
    );
  } catch (erro) {
    const recursoInexistente =
      erro?.code === "42703" ||
      erro?.code === "42P01";

    if (
      recursoInexistente
    ) {
      return {
        rows:
          rowsFallback,
      };
    }

    throw erro;
  }
}

/*
 * =========================================================
 * NEGÓCIOS
 * =========================================================
 */

async function listarNegocios() {
  const resultado =
    await db.query(
      `
        SELECT
          n.id,
          n.nome,
          n.slug,
          n.cidade,
          n.bairro,
          n.setor,

          n.whatsapp,
          n.whatsapp
            AS whatsapp_negocio,

          n.foto_url,

          COALESCE(
            n.ativo,
            TRUE
          ) AS ativo,

          n.created_at,
          n.updated_at,

          COALESCE(
            (
              SELECT COUNT(*)::INT

              FROM usuarios_negocios un

              WHERE un.negocio_id = n.id
                AND un.papel IN (
                  'dono',
                  'profissional'
                )
            ),
            0
          ) AS total_profissionais,

          COALESCE(
            (
              SELECT COUNT(*)::INT

              FROM servicos_negocio s

              WHERE s.negocio_id = n.id
            ),
            0
          ) AS total_servicos,

          COALESCE(
            (
              SELECT COUNT(*)::INT

              FROM agendamentos a

              WHERE a.negocio_id = n.id
                AND COALESCE(
                  a.status,
                  'agendado'
                ) <> 'cancelado'
            ),
            0
          ) AS total_agendamentos

        FROM negocios n

        ORDER BY
          n.created_at DESC,
          n.id DESC

        LIMIT 50
      `
    );

  return resultado.rows;
}

/*
 * =========================================================
 * AGENDAMENTOS
 * =========================================================
 */

async function listarAgendamentosRecentes() {
  const resultado =
    await db.query(
      `
        SELECT
          a.id,

          TO_CHAR(
            a.data,
            'YYYY-MM-DD'
          ) AS data,

          TO_CHAR(
            a.horario::TIME,
            'HH24:MI'
          ) AS horario,

          COALESCE(
            a.status,
            'agendado'
          ) AS status,

          a.cliente_id,

          COALESCE(
            NULLIF(
              BTRIM(c.nome),
              ''
            ),

            NULLIF(
              BTRIM(
                a.cliente_nome
              ),
              ''
            ),

            'Cliente não informado'
          ) AS cliente_nome,

          COALESCE(
            NULLIF(
              BTRIM(c.whatsapp),
              ''
            ),

            NULLIF(
              BTRIM(
                a.cliente_whatsapp
              ),
              ''
            )
          ) AS cliente_whatsapp,

          n.id
            AS negocio_id,

          n.nome
            AS negocio,

          s.id
            AS servico_id,

          s.nome
            AS servico,

          COALESCE(
            a.valor_servico,
            s.valor,
            0
          )::NUMERIC AS valor,

          p.id
            AS profissional_id,

          p.nome
            AS profissional,

          a.created_at

        FROM agendamentos a

        LEFT JOIN usuarios c
          ON c.id = a.cliente_id

        LEFT JOIN usuarios p
          ON p.id = a.profissional_id

        LEFT JOIN servicos_negocio s
          ON s.id = a.servico_id

        LEFT JOIN negocios n
          ON n.id = COALESCE(
            a.negocio_id,
            s.negocio_id
          )

        ORDER BY
          a.created_at DESC,
          a.id DESC

        LIMIT 20
      `
    );

  return resultado.rows;
}

/*
 * =========================================================
 * INDICADORES DO DASHBOARD
 * =========================================================
 */

async function buscarIndicadoresGerais(
  periodo = "all"
) {
  const filtroNegocios =
    filtroPeriodo(
      periodo,
      "n"
    );

  const filtroAgendamentos =
    filtroPeriodo(
      periodo,
      "a"
    );

  const filtroVinculos =
    filtroPeriodo(
      periodo,
      "un"
    );

  const resultado =
    await db.query(
      `
        SELECT
          (
            SELECT
              COUNT(*)::INT

            FROM negocios n

            WHERE 1 = 1
              ${filtroNegocios}
          ) AS total_negocios,

          (
            SELECT
              COUNT(
                DISTINCT
                CASE
                  WHEN a.cliente_id
                    IS NOT NULL
                  THEN
                    'usuario:' ||
                    a.cliente_id::TEXT

                  WHEN NULLIF(
                    REGEXP_REPLACE(
                      COALESCE(
                        a.cliente_whatsapp,
                        ''
                      ),
                      '\\D',
                      '',
                      'g'
                    ),
                    ''
                  ) IS NOT NULL
                  THEN
                    'whatsapp:' ||
                    REGEXP_REPLACE(
                      a.cliente_whatsapp,
                      '\\D',
                      '',
                      'g'
                    )

                  WHEN NULLIF(
                    BTRIM(
                      COALESCE(
                        a.cliente_nome,
                        ''
                      )
                    ),
                    ''
                  ) IS NOT NULL
                  THEN
                    'visitante:' ||
                    LOWER(
                      BTRIM(
                        a.cliente_nome
                      )
                    )

                  ELSE
                    'agendamento:' ||
                    a.id::TEXT
                END
              )::INT

            FROM agendamentos a

            WHERE 1 = 1
              ${filtroAgendamentos}
          ) AS total_clientes,

          (
            SELECT
              COUNT(
                DISTINCT
                un.usuario_id
              )::INT

            FROM usuarios_negocios un

            INNER JOIN usuarios u
              ON u.id =
                un.usuario_id

            WHERE un.papel IN (
              'dono',
              'profissional'
            )
              AND u.ativo = TRUE
              ${filtroVinculos}
          ) AS total_profissionais,

          (
            SELECT
              COUNT(*)::INT

            FROM agendamentos a

            WHERE 1 = 1
              ${filtroAgendamentos}
          ) AS total_agendamentos
      `
    );

  const indicadores =
    resultado.rows[0] ||
    {};

  return {
    totalNegocios:
      Number(
        indicadores
          .total_negocios ||
        0
      ),

    totalClientes:
      Number(
        indicadores
          .total_clientes ||
        0
      ),

    totalProfissionais:
      Number(
        indicadores
          .total_profissionais ||
        0
      ),

    totalAgendamentos:
      Number(
        indicadores
          .total_agendamentos ||
        0
      ),
  };
}

async function buscarIndicadoresHoje() {
  const resultado =
    await db.query(
      `
        SELECT
          (
            SELECT
              COUNT(*)::INT

            FROM usuarios

            WHERE created_at >=
              CURRENT_DATE
          ) AS usuarios_hoje,

          (
            SELECT
              COUNT(*)::INT

            FROM negocios

            WHERE created_at >=
              CURRENT_DATE
          ) AS negocios_hoje,

          (
            SELECT
              COUNT(*)::INT

            FROM agendamentos

            WHERE created_at >=
              CURRENT_DATE
          ) AS agendamentos_hoje
      `
    );

  const indicadores =
    resultado.rows[0] ||
    {};

  return {
    usuariosHoje:
      Number(
        indicadores
          .usuarios_hoje ||
        0
      ),

    negociosHoje:
      Number(
        indicadores
          .negocios_hoje ||
        0
      ),

    agendamentosHoje:
      Number(
        indicadores
          .agendamentos_hoje ||
        0
      ),
  };
}

async function buscarMetricasPlataforma(
  periodo = "all"
) {
  const filtroFavoritos =
    filtroPeriodo(
      periodo,
      "f"
    );

  const filtroEventos =
    filtroPeriodo(
      periodo,
      "e"
    );

  const [
    desempenho,
    favoritos,
  ] =
    await Promise.all([
      executarConsultaOpcional(
        `
          SELECT
            COUNT(*) FILTER (
              WHERE e.nome =
                'perfil_visualizado'
            )::INT
              AS visitas_plataforma,

            COUNT(*) FILTER (
              WHERE e.nome =
                'contato_selecionado'
                AND e.propriedades
                  ->> 'acao' =
                    'whatsapp'
            )::INT
              AS cliques_whatsapp,

            COUNT(*) FILTER (
              WHERE e.nome =
                'contato_selecionado'
                AND e.propriedades
                  ->> 'acao' =
                    'maps'
            )::INT
              AS cliques_maps

          FROM eventos_produto e

          WHERE 1 = 1
            ${filtroEventos}
        `,
        [],
        [
          {
            visitas_plataforma:
              0,

            cliques_whatsapp:
              0,

            cliques_maps:
              0,
          },
        ]
      ),

      db.query(
        `
          SELECT
            COUNT(*)::INT
              AS total

          FROM favoritos f

          WHERE 1 = 1
            ${filtroFavoritos}
        `
      ),
    ]);

  const metricas =
    desempenho.rows[0] ||
    {};

  return {
    visitasPlataforma:
      Number(
        metricas
          .visitas_plataforma ||
        0
      ),

    cliquesWhatsapp:
      Number(
        metricas
          .cliques_whatsapp ||
        0
      ),

    cliquesMaps:
      Number(
        metricas
          .cliques_maps ||
        0
      ),

    favoritosTotais:
      converterTotal(
        favoritos
      ),
  };
}

async function buscarFunilProduto(
  periodo = "all"
) {
  const filtro =
    filtroPeriodo(
      periodo,
      "e"
    );

  const resultado =
    await executarConsultaOpcional(
      `
        SELECT
          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE e.nome =
              'tela_visualizada'
              AND e.pagina =
                'inicio'
          )::INT
            AS descobriram,

          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE e.nome =
              'perfil_visualizado'
          )::INT
            AS avaliaram,

          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE e.nome =
              'agendamento_iniciado'
          )::INT
            AS iniciaram,

          COUNT(
            DISTINCT e.sessao_id
          ) FILTER (
            WHERE e.nome =
              'agendamento_concluido'
          )::INT
            AS concluiram,

          COUNT(*) FILTER (
            WHERE e.nome =
              'acao_dashboard_selecionada'
          )::INT
            AS acoes_dashboard,

          COUNT(*) FILTER (
            WHERE e.nome =
              'mensagem_crescimento_visualizada'
          )::INT
            AS mensagens_crescimento

        FROM eventos_produto e

        WHERE 1 = 1
          ${filtro}
      `,
      [],
      [
        {
          descobriram:
            0,
          avaliaram:
            0,
          iniciaram:
            0,
          concluiram:
            0,
          acoes_dashboard:
            0,
          mensagens_crescimento:
            0,
        },
      ]
    );

  return resultado
    .rows[0] ||
    {};
}

async function buscarDestaquesPlataforma() {
  const resultado =
    await db.query(
      `
        SELECT
          (
            SELECT
              cidade

            FROM negocios

            WHERE cidade IS NOT NULL
              AND BTRIM(cidade) <> ''

            GROUP BY cidade

            ORDER BY
              COUNT(*) DESC,
              cidade ASC

            LIMIT 1
          ) AS cidade_top,

          (
            SELECT
              setor

            FROM negocios

            WHERE setor IS NOT NULL
              AND BTRIM(setor) <> ''

            GROUP BY setor

            ORDER BY
              COUNT(*) DESC,
              setor ASC

            LIMIT 1
          ) AS setor_top
      `
    );

  const destaques =
    resultado.rows[0] ||
    {};

  return {
    cidadeTop:
      destaques.cidade_top ||
      "-",

    setorTop:
      destaques.setor_top ||
      "-",
  };
}

async function buscarQualidadeNegocios() {
  const resultado =
    await db.query(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE NOT EXISTS (
              SELECT 1

              FROM servicos_negocio s

              WHERE s.negocio_id =
                n.id
            )
          )::INT
            AS negocios_sem_servico,

          COUNT(*) FILTER (
            WHERE n.localizacao_url
              IS NULL

               OR BTRIM(
                 n.localizacao_url
               ) = ''
          )::INT
            AS negocios_sem_maps,

          COUNT(*) FILTER (
            WHERE n.whatsapp
              IS NULL

               OR BTRIM(
                 n.whatsapp
               ) = ''
          )::INT
            AS negocios_sem_whatsapp,

          COUNT(*) FILTER (
            WHERE n.whatsapp
              IS NOT NULL

              AND BTRIM(
                n.whatsapp
              ) <> ''

              AND n.localizacao_url
                IS NOT NULL

              AND BTRIM(
                n.localizacao_url
              ) <> ''

              AND EXISTS (
                SELECT 1

                FROM servicos_negocio s

                WHERE s.negocio_id =
                  n.id
              )
          )::INT
            AS negocios_completos

        FROM negocios n
      `
    );

  const qualidade =
    resultado.rows[0] ||
    {};

  return {
    negociosSemServico:
      Number(
        qualidade
          .negocios_sem_servico ||
        0
      ),

    negociosSemMaps:
      Number(
        qualidade
          .negocios_sem_maps ||
        0
      ),

    negociosSemWhatsapp:
      Number(
        qualidade
          .negocios_sem_whatsapp ||
        0
      ),

    negociosCompletos:
      Number(
        qualidade
          .negocios_completos ||
        0
      ),
  };
}

/*
 * =========================================================
 * MARKETING
 * =========================================================
 */

async function listarNegociosMaisAgendados() {
  const resultado =
    await db.query(
      `
        SELECT
          n.id,
          n.nome,
          n.slug,
          n.cidade,

          COUNT(
            a.id
          )::INT AS total,

          COALESCE(
            SUM(
              CASE
                WHEN a.id IS NOT NULL
                THEN COALESCE(
                  a.valor_servico,
                  s.valor,
                  0
                )
                ELSE 0
              END
            ),
            0
          )::NUMERIC
            AS faturamento

        FROM negocios n

        LEFT JOIN agendamentos a
          ON a.negocio_id = n.id

          AND COALESCE(
            a.status,
            'agendado'
          ) <> 'cancelado'

        LEFT JOIN servicos_negocio s
          ON s.id = a.servico_id

        GROUP BY
          n.id,
          n.nome,
          n.slug,
          n.cidade

        ORDER BY
          total DESC,
          faturamento DESC,
          n.nome ASC

        LIMIT 10
      `
    );

  return resultado.rows;
}

async function listarNegociosMaisVistos() {
  const resultado =
    await executarConsultaOpcional(
      `
        SELECT
          n.id,
          n.nome,
          n.slug,
          n.cidade,

          COUNT(*) FILTER (
            WHERE e.nome =
              'perfil_visualizado'
          )::INT
            AS visitas,

          COUNT(*) FILTER (
            WHERE e.nome =
              'contato_selecionado'
              AND e.propriedades
                ->> 'acao' =
                  'whatsapp'
          )::INT
            AS cliques_whatsapp,

          COUNT(*) FILTER (
            WHERE e.nome =
              'contato_selecionado'
              AND e.propriedades
                ->> 'acao' =
                  'maps'
          )::INT
            AS cliques_maps

        FROM negocios n

        LEFT JOIN eventos_produto e
          ON e.negocio_id =
            n.id

        GROUP BY
          n.id,
          n.nome,
          n.slug,
          n.cidade

        ORDER BY
          visitas DESC,
          cliques_whatsapp DESC,
          n.nome ASC

        LIMIT 10
      `,
      [],
      []
    );

  return resultado.rows;
}

async function listarCidadesTop() {
  const resultado =
    await db.query(
      `
        SELECT
          cidade,
          COUNT(*)::INT
            AS total

        FROM negocios

        WHERE cidade IS NOT NULL
          AND BTRIM(cidade) <> ''

        GROUP BY cidade

        ORDER BY
          total DESC,
          cidade ASC

        LIMIT 10
      `
    );

  return resultado.rows;
}

async function listarUsuariosRecentes() {
  const resultado =
    await db.query(
      `
        SELECT
          u.id,
          u.nome,
          u.email,
          u.whatsapp,
          u.foto_url,
          u.ativo,
          u.created_at,

          COALESCE(
            ARRAY_REMOVE(
              ARRAY_AGG(
                DISTINCT un.papel
              ),
              NULL
            ),
            ARRAY[]::TEXT[]
          ) AS papeis_negocio,

          ua.papel
            AS papel_admin,

          CASE
            WHEN ua.papel =
              'superadmin'
            THEN
              'superadmin'

            WHEN ua.papel =
              'admin'
            THEN
              'admin'

            WHEN BOOL_OR(
              un.papel = 'dono'
            )
            THEN
              'dono'

            WHEN BOOL_OR(
              un.papel =
                'profissional'
            )
            THEN
              'profissional'

            WHEN EXISTS (
              SELECT 1

              FROM agendamentos a

              WHERE a.cliente_id =
                u.id
            )
            THEN
              'cliente'

            ELSE
              'usuario'
          END AS perfil,

          /*
           * Alias temporário para o
           * frontend administrativo antigo.
           *
           * Não existe coluna usuarios.tipo.
           */
          CASE
            WHEN ua.papel =
              'superadmin'
            THEN
              'superadmin'

            WHEN ua.papel =
              'admin'
            THEN
              'admin'

            WHEN BOOL_OR(
              un.papel = 'dono'
            )
            THEN
              'dono'

            WHEN BOOL_OR(
              un.papel =
                'profissional'
            )
            THEN
              'profissional'

            WHEN EXISTS (
              SELECT 1

              FROM agendamentos a

              WHERE a.cliente_id =
                u.id
            )
            THEN
              'cliente'

            ELSE
              'usuario'
          END AS tipo

        FROM usuarios u

        LEFT JOIN usuarios_negocios un
          ON un.usuario_id =
            u.id

        LEFT JOIN usuarios_administradores ua
          ON ua.usuario_id =
            u.id

          AND ua.ativo = TRUE

        GROUP BY
          u.id,
          u.nome,
          u.email,
          u.whatsapp,
          u.foto_url,
          u.ativo,
          u.created_at,
          ua.papel

        ORDER BY
          u.created_at DESC,
          u.id DESC

        LIMIT 10
      `
    );

  return resultado.rows;
}

module.exports = {
  listarNegocios,
  listarAgendamentosRecentes,

  buscarIndicadoresGerais,
  buscarIndicadoresHoje,
  buscarMetricasPlataforma,
  buscarFunilProduto,
  buscarDestaquesPlataforma,
  buscarQualidadeNegocios,

  listarNegociosMaisAgendados,
  listarNegociosMaisVistos,
  listarCidadesTop,
  listarUsuariosRecentes,
};
