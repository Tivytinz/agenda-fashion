const db = require("../db/db");

const TIPOS_ATIVOS = [
  "NOVO_AGENDAMENTO_PROFISSIONAL",
  "CONFIRMACAO_AGENDAMENTO_CLIENTE",
  "LEMBRETE_AGENDAMENTO_CLIENTE",
  "LEMBRETE_AGENDAMENTO_PROFISSIONAL",
];

const TIPOS_CANCELAMENTO = [
  "CANCELAMENTO_AGENDAMENTO_PROFISSIONAL",
  "CANCELAMENTO_AGENDAMENTO_CLIENTE",
];

const TIPOS_NEGOCIO = [
  "LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO",
  "LEMBRETE_DIVULGAR_NEGOCIO",
];

const TIPOS_CLIENTE = [
  "CONFIRMACAO_AGENDAMENTO_CLIENTE",
  "LEMBRETE_AGENDAMENTO_CLIENTE",
  "CANCELAMENTO_AGENDAMENTO_CLIENTE",
];

const TIPOS_PROFISSIONAL = [
  "NOVO_AGENDAMENTO_PROFISSIONAL",
  "LEMBRETE_AGENDAMENTO_PROFISSIONAL",
  "CANCELAMENTO_AGENDAMENTO_PROFISSIONAL",
];

function validarExecutor(
  executor
) {
  if (
    !executor ||
    typeof executor.query !==
      "function"
  ) {
    throw new Error(
      "Executor de banco de dados inválido."
    );
  }
}

function normalizarTelefoneNacional(
  telefone
) {
  const normalizado =
    String(telefone || "")
      .replace(/\D/g, "")
      .replace(
        /^55(?=\d{10,11}$)/,
        ""
      );

  return /^[0-9]{10,11}$/.test(
    normalizado
  )
    ? normalizado
    : null;
}

async function enfileirarNovoAgendamento(
  executor,
  agendamentoId,
  antecedenciaLembreteHoras = 24,
  lembreteProfissionalAtivo = false
) {
  validarExecutor(
    executor
  );

  const result =
    await executor.query(
      `
        WITH dados AS (
          SELECT
            a.id AS agendamento_id,

            COALESCE(
              NULLIF(
                BTRIM(a.cliente_nome),
                ''
              ),
              cliente.nome,
              'Cliente'
            ) AS cliente_nome,

            COALESCE(
              NULLIF(
                REGEXP_REPLACE(
                  a.cliente_whatsapp,
                  '[^0-9]',
                  '',
                  'g'
                ),
                ''
              ),
              REGEXP_REPLACE(
                cliente.whatsapp,
                '[^0-9]',
                '',
                'g'
              )
            ) AS cliente_whatsapp,

            REGEXP_REPLACE(
              profissional.whatsapp,
              '[^0-9]',
              '',
              'g'
            ) AS profissional_whatsapp,

            (
              profissional.whatsapp_operacional_consentido_em
                IS NOT NULL
              AND profissional.whatsapp_operacional_cancelado_em
                IS NULL
            ) AS profissional_whatsapp_consentido,

            profissional.nome
              AS profissional_nome,

            n.nome
              AS negocio_nome,

            s.nome
              AS servico_nome,

            TO_CHAR(
              a.data,
              'DD/MM/YYYY'
            ) AS data_formatada,

            TO_CHAR(
              a.horario::TIME,
              'HH24:MI'
            ) AS horario_formatado,

            (
              a.whatsapp_consentido_em
              IS NOT NULL
            ) AS whatsapp_consentido,

            (
              a.data +
              a.horario::TIME
            ) AT TIME ZONE
              'America/Sao_Paulo'
              AS inicio_agendamento

          FROM agendamentos a

          JOIN negocios n
            ON n.id = a.negocio_id

          JOIN servicos_negocio s
            ON s.id = a.servico_id

          JOIN usuarios profissional
            ON profissional.id =
              a.profissional_id

          LEFT JOIN usuarios cliente
            ON cliente.id =
              a.cliente_id

          WHERE a.id = $1
            AND a.status IN (
              'agendado',
              'confirmado'
            )
        ),

        mensagens AS (
          SELECT
            agendamento_id,
            'NOVO_AGENDAMENTO_PROFISSIONAL'
              AS tipo,
            profissional_whatsapp
              AS destinatario,
            JSONB_BUILD_ARRAY(
              profissional_nome,
              cliente_nome,
              cliente_whatsapp,
              servico_nome,
              data_formatada,
              horario_formatado
            ) AS parametros_corpo,
            NOW()
              AS agendado_para,
            NOW() +
              INTERVAL '2 hours'
              AS expira_em

          FROM dados

          WHERE profissional_whatsapp
            ~ '^[0-9]{10,13}$'
            AND profissional_whatsapp_consentido

          UNION ALL

          SELECT
            agendamento_id,
            'CONFIRMACAO_AGENDAMENTO_CLIENTE',
            cliente_whatsapp,
            JSONB_BUILD_ARRAY(
              cliente_nome,
              negocio_nome,
              servico_nome,
              data_formatada,
              horario_formatado
            ),
            NOW(),
            NOW() +
              INTERVAL '2 hours'

          FROM dados

          WHERE cliente_whatsapp
            ~ '^[0-9]{10,13}$'
            AND whatsapp_consentido

          UNION ALL

          SELECT
            agendamento_id,
            'LEMBRETE_AGENDAMENTO_PROFISSIONAL',
            profissional_whatsapp,
            JSONB_BUILD_ARRAY(
              profissional_nome,
              cliente_nome,
              cliente_whatsapp,
              servico_nome,
              data_formatada,
              horario_formatado
            ),
            inicio_agendamento -
              MAKE_INTERVAL(
                hours => $2
              ),
            inicio_agendamento

          FROM dados

          WHERE profissional_whatsapp
            ~ '^[0-9]{10,13}$'
            AND profissional_whatsapp_consentido
            AND $3::BOOLEAN
            AND (
              inicio_agendamento -
              MAKE_INTERVAL(
                hours => $2
              )
            ) > NOW()

          UNION ALL

          SELECT
            agendamento_id,
            'LEMBRETE_AGENDAMENTO_CLIENTE',
            cliente_whatsapp,
            JSONB_BUILD_ARRAY(
              cliente_nome,
              negocio_nome,
              servico_nome,
              data_formatada,
              horario_formatado
            ),
            inicio_agendamento -
              MAKE_INTERVAL(
                hours => $2
              ),
            inicio_agendamento

          FROM dados

          WHERE cliente_whatsapp
            ~ '^[0-9]{10,13}$'
            AND whatsapp_consentido
            AND (
              inicio_agendamento -
              MAKE_INTERVAL(
                hours => $2
              )
            ) > NOW()
        )

        INSERT INTO whatsapp_mensagens (
          agendamento_id,
          tipo,
          destinatario,
          parametros_corpo,
          agendado_para,
          expira_em,
          proxima_tentativa_em
        )

        SELECT
          agendamento_id,
          tipo,
          destinatario,
          parametros_corpo,
          agendado_para,
          expira_em,
          agendado_para

        FROM mensagens

        ON CONFLICT (
          agendamento_id,
          tipo,
          destinatario
        )
        DO NOTHING

        RETURNING
          id,
          tipo,
          destinatario,
          agendado_para,
          status
      `,
      [
        agendamentoId,
        antecedenciaLembreteHoras,
        lembreteProfissionalAtivo,
      ]
    );

  return result.rows;
}

async function enfileirarCancelamento(
  executor,
  agendamentoId
) {
  validarExecutor(
    executor
  );

  await executor.query(
    `
      UPDATE whatsapp_mensagens

      SET
        status = 'CANCELED',
        bloqueado_em = NULL,
        ultimo_erro =
          'Mensagem cancelada porque o agendamento foi cancelado.'

      WHERE agendamento_id = $1
        AND tipo = ANY($2::VARCHAR[])
        AND status IN (
          'PENDING',
          'FAILED',
          'PROCESSING'
        )
    `,
    [
      agendamentoId,
      TIPOS_ATIVOS,
    ]
  );

  const result =
    await executor.query(
      `
        WITH dados AS (
          SELECT
            a.id AS agendamento_id,

            COALESCE(
              NULLIF(
                BTRIM(a.cliente_nome),
                ''
              ),
              cliente.nome,
              'Cliente'
            ) AS cliente_nome,

            COALESCE(
              NULLIF(
                REGEXP_REPLACE(
                  a.cliente_whatsapp,
                  '[^0-9]',
                  '',
                  'g'
                ),
                ''
              ),
              REGEXP_REPLACE(
                cliente.whatsapp,
                '[^0-9]',
                '',
                'g'
              )
            ) AS cliente_whatsapp,

            REGEXP_REPLACE(
              profissional.whatsapp,
              '[^0-9]',
              '',
              'g'
            ) AS profissional_whatsapp,

            (
              profissional.whatsapp_operacional_consentido_em
                IS NOT NULL
              AND profissional.whatsapp_operacional_cancelado_em
                IS NULL
            ) AS profissional_whatsapp_consentido,

            n.nome
              AS negocio_nome,

            s.nome
              AS servico_nome,

            profissional.nome
              AS profissional_nome,

            TO_CHAR(
              a.data,
              'DD/MM/YYYY'
            ) AS data_formatada,

            TO_CHAR(
              a.horario::TIME,
              'HH24:MI'
            ) AS horario_formatado,

            (
              a.whatsapp_consentido_em
              IS NOT NULL
            ) AS whatsapp_consentido

          FROM agendamentos a

          JOIN negocios n
            ON n.id = a.negocio_id

          JOIN servicos_negocio s
            ON s.id = a.servico_id

          JOIN usuarios profissional
            ON profissional.id =
              a.profissional_id

          LEFT JOIN usuarios cliente
            ON cliente.id =
              a.cliente_id

          WHERE a.id = $1
            AND a.status = 'cancelado'
        ),

        mensagens AS (
          SELECT
            agendamento_id,
            'CANCELAMENTO_AGENDAMENTO_PROFISSIONAL'
              AS tipo,
            profissional_whatsapp
              AS destinatario,
            JSONB_BUILD_ARRAY(
              profissional_nome,
              cliente_nome,
              cliente_whatsapp,
              servico_nome,
              data_formatada,
              horario_formatado
            ) AS parametros_corpo,
            NOW() +
              INTERVAL '2 hours'
              AS expira_em

          FROM dados

          WHERE profissional_whatsapp
            ~ '^[0-9]{10,13}$'
            AND profissional_whatsapp_consentido

          UNION ALL

          SELECT
            agendamento_id,
            'CANCELAMENTO_AGENDAMENTO_CLIENTE',
            cliente_whatsapp,
            JSONB_BUILD_ARRAY(
              cliente_nome,
              negocio_nome,
              servico_nome,
              data_formatada,
              horario_formatado
            ),
            NOW() +
              INTERVAL '2 hours'

          FROM dados

          WHERE cliente_whatsapp
            ~ '^[0-9]{10,13}$'
            AND whatsapp_consentido
        )

        INSERT INTO whatsapp_mensagens (
          agendamento_id,
          tipo,
          destinatario,
          parametros_corpo,
          agendado_para,
          expira_em,
          proxima_tentativa_em
        )

        SELECT
          agendamento_id,
          tipo,
          destinatario,
          parametros_corpo,
          NOW(),
          expira_em,
          NOW()

        FROM mensagens

        ON CONFLICT (
          agendamento_id,
          tipo,
          destinatario
        )
        DO NOTHING

        RETURNING
          id,
          tipo,
          destinatario,
          agendado_para,
          status
      `,
      [agendamentoId]
    );

  return result.rows;
}

async function enfileirarLembretesDiariosNegocios(
  horaLocal = 10,
  lembretePrimeiroServicoAtivo = false,
  lembreteDivulgacaoAtivo = false,
  maximoEnvios = 3,
  intervaloMinimoDias = 3
) {
  const result = await db.query(
    `
      WITH negocios_validos AS (
        SELECT
          n.*,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM pg_timezone_names tz
              WHERE tz.name = n.fuso_horario
            ) THEN n.fuso_horario
            ELSE 'America/Sao_Paulo'
          END AS fuso_envio

        FROM negocios n
      ),

      elegiveis AS (
        SELECT
          n.id AS negocio_id,
          (NOW() AT TIME ZONE n.fuso_envio)::DATE
            AS data_referencia,
          COALESCE(
            NULLIF(
              REGEXP_REPLACE(u.whatsapp, '[^0-9]', '', 'g'),
              ''
            ),
            NULLIF(
              REGEXP_REPLACE(n.whatsapp, '[^0-9]', '', 'g'),
              ''
            )
          ) AS destinatario,
          u.nome AS proprietario_nome,
          n.nome AS negocio_nome,
          n.slug,
          n.publicado,
          EXISTS (
            SELECT 1
            FROM servicos_negocio s
            WHERE s.negocio_id = n.id
              AND s.ativo = TRUE
          ) AS possui_servico,
          EXISTS (
            SELECT 1
            FROM usuarios_negocios agenda_un
            INNER JOIN agenda_configuracoes ac
              ON ac.profissional_id =
                agenda_un.usuario_id
            WHERE agenda_un.negocio_id =
                n.id
              AND agenda_un.ativo = TRUE
              AND agenda_un.papel IN (
                'dono',
                'profissional'
              )
              AND ac.configurado_em
                IS NOT NULL
          ) AS agenda_configurada,
          (
            (
              (NOW() AT TIME ZONE n.fuso_envio)::DATE + 1
            )::TIMESTAMP AT TIME ZONE n.fuso_envio
          ) AS expira_em

        FROM negocios_validos n

        JOIN usuarios_negocios un
          ON un.negocio_id = n.id
          AND un.papel = 'dono'
          AND un.ativo = TRUE

        JOIN usuarios u
          ON u.id = un.usuario_id
          AND u.ativo = TRUE

        WHERE n.ativo = TRUE
          AND n.created_at <= NOW() - INTERVAL '24 hours'
          AND u.whatsapp_marketing_consentido_em IS NOT NULL
          AND u.whatsapp_marketing_cancelado_em IS NULL
          AND EXTRACT(
            HOUR FROM NOW() AT TIME ZONE n.fuso_envio
          ) >= $1
      ),

      mensagens_candidatas AS (
        SELECT
          negocio_id,
          data_referencia,
          CASE
            WHEN possui_servico = FALSE
              THEN 'LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO'
            ELSE 'LEMBRETE_DIVULGAR_NEGOCIO'
          END AS tipo,
          destinatario,
          CASE
            WHEN possui_servico = FALSE
              THEN '[]'::JSONB
            ELSE JSONB_BUILD_ARRAY(
              proprietario_nome,
              negocio_nome,
              'https://app.agendafashion.com.br/negocio/' || slug
            )
          END AS parametros_corpo,
          expira_em

        FROM elegiveis

        WHERE destinatario ~ '^[0-9]{10,13}$'
          AND (
            (
              possui_servico = FALSE
              AND $2::BOOLEAN
            )
            OR
            (
              possui_servico = TRUE
              AND publicado = TRUE
              AND agenda_configurada = TRUE
              AND $3::BOOLEAN
            )
          )
      ),

      mensagens AS (
        SELECT candidata.*

        FROM mensagens_candidatas candidata

        WHERE (
            SELECT COUNT(*)
            FROM whatsapp_mensagens historico
            WHERE historico.negocio_id =
              candidata.negocio_id
              AND historico.tipo IN (
                'LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO',
                'LEMBRETE_DIVULGAR_NEGOCIO'
              )
              AND historico.status <>
                'CANCELED'
          ) < $4::INTEGER
          AND NOT EXISTS (
            SELECT 1
            FROM whatsapp_mensagens recente
            WHERE recente.negocio_id =
              candidata.negocio_id
              AND recente.tipo IN (
                'LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO',
                'LEMBRETE_DIVULGAR_NEGOCIO'
              )
              AND recente.status <>
                'CANCELED'
              AND recente.data_referencia >
                candidata.data_referencia -
                  $5::INTEGER
          )
      )

      INSERT INTO whatsapp_mensagens (
        negocio_id,
        data_referencia,
        tipo,
        destinatario,
        parametros_corpo,
        agendado_para,
        expira_em,
        proxima_tentativa_em
      )

      SELECT
        negocio_id,
        data_referencia,
        tipo,
        destinatario,
        parametros_corpo,
        NOW(),
        expira_em,
        NOW()

      FROM mensagens

      ON CONFLICT (
        negocio_id,
        data_referencia
      )
      WHERE negocio_id IS NOT NULL
      DO NOTHING

      RETURNING
        id,
        negocio_id,
        tipo,
        destinatario,
        data_referencia,
        status
    `,
    [
      horaLocal,
      lembretePrimeiroServicoAtivo,
      lembreteDivulgacaoAtivo,
      maximoEnvios,
      intervaloMinimoDias,
    ]
  );

  return result.rows;
}

async function reservarProximaMensagem() {
  const result =
    await db.query(
      `
        WITH candidata AS (
          SELECT wm.id

          FROM whatsapp_mensagens wm

          LEFT JOIN agendamentos a
            ON a.id =
              wm.agendamento_id

          LEFT JOIN negocios n
            ON n.id = wm.negocio_id

          LEFT JOIN usuarios profissional_agendamento
            ON profissional_agendamento.id =
              a.profissional_id

          LEFT JOIN usuarios_negocios un
            ON un.negocio_id = n.id
            AND un.papel = 'dono'
            AND un.ativo = TRUE

          LEFT JOIN usuarios u
            ON u.id = un.usuario_id
            AND u.ativo = TRUE

          LEFT JOIN usuarios cliente_conta
            ON cliente_conta.id = a.cliente_id
            AND cliente_conta.ativo = TRUE

          WHERE (
              (
                wm.status IN (
                  'PENDING',
                  'FAILED'
                )
                AND
                wm.proxima_tentativa_em
                  <= NOW()
              )
              OR
              (
                wm.status =
                  'PROCESSING'
                AND
                wm.bloqueado_em <
                  NOW() -
                  INTERVAL '15 minutes'
              )
            )
            AND wm.agendado_para
              <= NOW()
            AND wm.expira_em
              > NOW()
            AND wm.tentativas
              < wm.max_tentativas
            AND (
              (
                wm.tipo =
                  ANY($1::VARCHAR[])
                AND a.status IN (
                  'agendado',
                  'confirmado'
                )
              )
              OR
              (
                wm.tipo =
                  ANY($2::VARCHAR[])
                AND a.status =
                  'cancelado'
              )
              OR
              (
                wm.tipo =
                  ANY($3::VARCHAR[])
                AND n.ativo = TRUE
                AND u.whatsapp_marketing_consentido_em
                  IS NOT NULL
                AND u.whatsapp_marketing_cancelado_em
                  IS NULL
                AND (
                  (
                    wm.tipo =
                      'LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO'
                    AND NOT EXISTS (
                      SELECT 1
                      FROM servicos_negocio s
                      WHERE s.negocio_id = n.id
                        AND s.ativo = TRUE
                    )
                  )
                  OR
                  (
                    wm.tipo =
                      'LEMBRETE_DIVULGAR_NEGOCIO'
                    AND n.publicado = TRUE
                    AND EXISTS (
                      SELECT 1
                      FROM servicos_negocio s
                      WHERE s.negocio_id = n.id
                        AND s.ativo = TRUE
                    )
                  )
                )
              )
            )
            AND (
              wm.tipo <> ALL($4::VARCHAR[])
              OR (
                profissional_agendamento.whatsapp_operacional_consentido_em
                  IS NOT NULL
                AND profissional_agendamento.whatsapp_operacional_cancelado_em
                  IS NULL
              )
            )
            AND (
              wm.tipo <> ALL($5::VARCHAR[])
              OR (
                a.whatsapp_consentido_em
                  IS NOT NULL
                AND (
                  a.cliente_id IS NULL
                  OR (
                    cliente_conta.whatsapp_notificacoes_consentido_em
                      IS NOT NULL
                    AND cliente_conta.whatsapp_notificacoes_cancelado_em
                      IS NULL
                    AND REGEXP_REPLACE(
                      cliente_conta.whatsapp,
                      '[^0-9]',
                      '',
                      'g'
                    ) = CASE
                      WHEN REGEXP_REPLACE(
                        wm.destinatario,
                        '[^0-9]',
                        '',
                        'g'
                      ) ~ '^55[0-9]{10,11}$'
                        THEN SUBSTRING(
                          REGEXP_REPLACE(
                            wm.destinatario,
                            '[^0-9]',
                            '',
                            'g'
                          )
                          FROM 3
                        )
                      ELSE REGEXP_REPLACE(
                        wm.destinatario,
                        '[^0-9]',
                        '',
                        'g'
                      )
                    END
                  )
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM whatsapp_interacoes_recebidas optout
                  WHERE optout.intencao =
                      'GLOBAL_OPTOUT'
                    AND optout.recebido_em >=
                      a.whatsapp_consentido_em
                    AND CASE
                      WHEN optout.telefone
                        ~ '^55[0-9]{10,11}$'
                        THEN SUBSTRING(
                          optout.telefone
                          FROM 3
                        )
                      ELSE optout.telefone
                    END = CASE
                      WHEN REGEXP_REPLACE(
                        wm.destinatario,
                        '[^0-9]',
                        '',
                        'g'
                      ) ~ '^55[0-9]{10,11}$'
                        THEN SUBSTRING(
                          REGEXP_REPLACE(
                            wm.destinatario,
                            '[^0-9]',
                            '',
                            'g'
                          )
                          FROM 3
                        )
                      ELSE REGEXP_REPLACE(
                        wm.destinatario,
                        '[^0-9]',
                        '',
                        'g'
                      )
                    END
                )
              )
            )

          ORDER BY
            wm.agendado_para,
            wm.id

          FOR UPDATE OF wm
          SKIP LOCKED

          LIMIT 1
        )

        UPDATE whatsapp_mensagens wm

        SET
          status = 'PROCESSING',
          tentativas =
            wm.tentativas + 1,
          bloqueado_em = NOW(),
          ultimo_erro = NULL

        FROM candidata

        WHERE wm.id =
          candidata.id

        RETURNING wm.*
      `,
      [
        TIPOS_ATIVOS,
        TIPOS_CANCELAMENTO,
        TIPOS_NEGOCIO,
        TIPOS_PROFISSIONAL,
        TIPOS_CLIENTE,
      ]
    );

  return result.rows[0] || null;
}

async function mensagemContinuaValida(
  mensagemId
) {
  const result =
    await db.query(
      `
        SELECT EXISTS (
          SELECT 1

          FROM whatsapp_mensagens wm

          LEFT JOIN agendamentos a
            ON a.id =
              wm.agendamento_id

          LEFT JOIN negocios n
            ON n.id = wm.negocio_id

          LEFT JOIN usuarios profissional_agendamento
            ON profissional_agendamento.id =
              a.profissional_id

          LEFT JOIN usuarios_negocios un
            ON un.negocio_id = n.id
            AND un.papel = 'dono'
            AND un.ativo = TRUE

          LEFT JOIN usuarios u
            ON u.id = un.usuario_id
            AND u.ativo = TRUE

          LEFT JOIN usuarios cliente_conta
            ON cliente_conta.id = a.cliente_id
            AND cliente_conta.ativo = TRUE

          WHERE wm.id = $1
            AND wm.status =
              'PROCESSING'
            AND wm.expira_em
              > NOW()
            AND (
              (
                wm.tipo =
                  ANY($2::VARCHAR[])
                AND a.status IN (
                  'agendado',
                  'confirmado'
                )
              )
              OR
              (
                wm.tipo =
                  ANY($3::VARCHAR[])
                AND a.status =
                  'cancelado'
              )
              OR
              (
                wm.tipo =
                  ANY($4::VARCHAR[])
                AND n.ativo = TRUE
                AND u.whatsapp_marketing_consentido_em
                  IS NOT NULL
                AND u.whatsapp_marketing_cancelado_em
                  IS NULL
                AND (
                  (
                    wm.tipo =
                      'LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO'
                    AND NOT EXISTS (
                      SELECT 1
                      FROM servicos_negocio s
                      WHERE s.negocio_id = n.id
                        AND s.ativo = TRUE
                    )
                  )
                  OR
                  (
                    wm.tipo =
                      'LEMBRETE_DIVULGAR_NEGOCIO'
                    AND n.publicado = TRUE
                    AND EXISTS (
                      SELECT 1
                      FROM servicos_negocio s
                      WHERE s.negocio_id = n.id
                        AND s.ativo = TRUE
                    )
                  )
                )
              )
            )
            AND (
              wm.tipo <> ALL($5::VARCHAR[])
              OR (
                profissional_agendamento.whatsapp_operacional_consentido_em
                  IS NOT NULL
                AND profissional_agendamento.whatsapp_operacional_cancelado_em
                  IS NULL
              )
            )
            AND (
              wm.tipo <> ALL($6::VARCHAR[])
              OR (
                a.whatsapp_consentido_em
                  IS NOT NULL
                AND (
                  a.cliente_id IS NULL
                  OR (
                    cliente_conta.whatsapp_notificacoes_consentido_em
                      IS NOT NULL
                    AND cliente_conta.whatsapp_notificacoes_cancelado_em
                      IS NULL
                    AND REGEXP_REPLACE(
                      cliente_conta.whatsapp,
                      '[^0-9]',
                      '',
                      'g'
                    ) = CASE
                      WHEN REGEXP_REPLACE(
                        wm.destinatario,
                        '[^0-9]',
                        '',
                        'g'
                      ) ~ '^55[0-9]{10,11}$'
                        THEN SUBSTRING(
                          REGEXP_REPLACE(
                            wm.destinatario,
                            '[^0-9]',
                            '',
                            'g'
                          )
                          FROM 3
                        )
                      ELSE REGEXP_REPLACE(
                        wm.destinatario,
                        '[^0-9]',
                        '',
                        'g'
                      )
                    END
                  )
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM whatsapp_interacoes_recebidas optout
                  WHERE optout.intencao =
                      'GLOBAL_OPTOUT'
                    AND optout.recebido_em >=
                      a.whatsapp_consentido_em
                    AND CASE
                      WHEN optout.telefone
                        ~ '^55[0-9]{10,11}$'
                        THEN SUBSTRING(
                          optout.telefone
                          FROM 3
                        )
                      ELSE optout.telefone
                    END = CASE
                      WHEN REGEXP_REPLACE(
                        wm.destinatario,
                        '[^0-9]',
                        '',
                        'g'
                      ) ~ '^55[0-9]{10,11}$'
                        THEN SUBSTRING(
                          REGEXP_REPLACE(
                            wm.destinatario,
                            '[^0-9]',
                            '',
                            'g'
                          )
                          FROM 3
                        )
                      ELSE REGEXP_REPLACE(
                        wm.destinatario,
                        '[^0-9]',
                        '',
                        'g'
                      )
                    END
                )
              )
            )
        ) AS valida
      `,
      [
        mensagemId,
        TIPOS_ATIVOS,
        TIPOS_CANCELAMENTO,
        TIPOS_NEGOCIO,
        TIPOS_PROFISSIONAL,
        TIPOS_CLIENTE,
      ]
    );

  return Boolean(
    result.rows[0]?.valida
  );
}

async function cancelarMensagensExpiradas() {
  const result =
    await db.query(
      `
        UPDATE whatsapp_mensagens

        SET
          status = 'CANCELED',
          bloqueado_em = NULL,
          ultimo_erro =
            'Mensagem expirada antes do envio.'

        WHERE status IN (
            'PENDING',
            'FAILED',
            'PROCESSING'
          )
          AND expira_em
            <= NOW()

        RETURNING id
      `
    );

  return result.rowCount || 0;
}

async function cancelarMarketingPorWhatsapp(
  telefone
) {
  const telefoneNacional =
    normalizarTelefoneNacional(
      telefone
    );

  if (!telefoneNacional) {
    return {
      usuarios: 0,
      mensagensCanceladas: 0,
    };
  }

  return db.executarTransacao(
    async (executor) => {
      const usuarios =
        await executor.query(
          `
            UPDATE usuarios
            SET
              whatsapp_marketing_cancelado_em =
                NOW()
            WHERE ativo = TRUE
              AND whatsapp_marketing_consentido_em
                IS NOT NULL
              AND whatsapp_marketing_cancelado_em
                IS NULL
              AND REGEXP_REPLACE(
                whatsapp,
                '[^0-9]',
                '',
                'g'
              ) = $1
            RETURNING
              id,
              whatsapp
          `,
          [telefoneNacional]
        );

      if (usuarios.rowCount > 0) {
        await executor.query(
          `
            INSERT INTO whatsapp_consentimentos (
              usuario_id,
              telefone,
              escopo,
              acao,
              origem,
              texto_versao
            )
            SELECT
              usuario_cancelado.id,
              usuario_cancelado.whatsapp,
              'MARKETING_PROFISSIONAL',
              'CANCELADO',
              'WHATSAPP',
              'optout-whatsapp-v1'
            FROM JSONB_TO_RECORDSET($1::JSONB)
              AS usuario_cancelado(
                id BIGINT,
                whatsapp VARCHAR(13)
              )
          `,
          [JSON.stringify(usuarios.rows)]
        );
      }

      const mensagens =
        await executor.query(
          `
            UPDATE whatsapp_mensagens
            SET
              status = 'CANCELED',
              bloqueado_em = NULL,
              ultimo_erro =
                'Marketing cancelado pelo destinatário no WhatsApp.'
            WHERE tipo = ANY($1::VARCHAR[])
              AND destinatario = ANY($2::VARCHAR[])
              AND status IN (
                'PENDING',
                'FAILED',
                'PROCESSING'
              )
            RETURNING id
          `,
          [
            TIPOS_NEGOCIO,
            [
              telefoneNacional,
              `55${telefoneNacional}`,
            ],
          ]
        );

      return {
        usuarios:
          usuarios.rowCount || 0,
        mensagensCanceladas:
          mensagens.rowCount || 0,
      };
    }
  );
}

async function cancelarTodasComunicacoesPorWhatsapp(
  telefone
) {
  const telefoneNacional =
    normalizarTelefoneNacional(
      telefone
    );

  if (!telefoneNacional) {
    return {
      usuarios: 0,
      agendamentos: 0,
      mensagensCanceladas: 0,
    };
  }

  return db.executarTransacao(
    async (executor) => {
      const usuarios =
        await executor.query(
          `
            WITH anteriores AS (
              SELECT
                id,
                whatsapp,
                (
                  whatsapp_notificacoes_consentido_em
                    IS NOT NULL
                  AND whatsapp_notificacoes_cancelado_em
                    IS NULL
                ) AS cliente_ativo,
                (
                  whatsapp_operacional_consentido_em
                    IS NOT NULL
                  AND whatsapp_operacional_cancelado_em
                    IS NULL
                ) AS profissional_ativo,
                (
                  whatsapp_marketing_consentido_em
                    IS NOT NULL
                  AND whatsapp_marketing_cancelado_em
                    IS NULL
                ) AS marketing_ativo
              FROM usuarios
              WHERE ativo = TRUE
                AND REGEXP_REPLACE(
                  whatsapp,
                  '[^0-9]',
                  '',
                  'g'
                ) = $1
              FOR UPDATE
            ),
            atualizados AS (
              UPDATE usuarios usuario
              SET
                whatsapp_notificacoes_cancelado_em =
                  CASE
                    WHEN anterior.cliente_ativo
                      THEN NOW()
                    ELSE usuario.whatsapp_notificacoes_cancelado_em
                  END,
                whatsapp_operacional_cancelado_em =
                  CASE
                    WHEN anterior.profissional_ativo
                      THEN NOW()
                    ELSE usuario.whatsapp_operacional_cancelado_em
                  END,
                whatsapp_marketing_cancelado_em =
                  CASE
                    WHEN anterior.marketing_ativo
                      THEN NOW()
                    ELSE usuario.whatsapp_marketing_cancelado_em
                  END
              FROM anteriores anterior
              WHERE usuario.id = anterior.id
              RETURNING
                usuario.id,
                usuario.whatsapp,
                anterior.cliente_ativo,
                anterior.profissional_ativo,
                anterior.marketing_ativo
            )
            SELECT *
            FROM atualizados
            WHERE cliente_ativo
              OR profissional_ativo
              OR marketing_ativo
          `,
          [telefoneNacional]
        );

      if (usuarios.rowCount > 0) {
        await executor.query(
          `
            INSERT INTO whatsapp_consentimentos (
              usuario_id,
              telefone,
              escopo,
              acao,
              origem,
              texto_versao
            )
            SELECT
              usuario_cancelado.id,
              usuario_cancelado.whatsapp,
              preferencia.escopo,
              'CANCELADO',
              'WHATSAPP',
              'optout-global-whatsapp-v1'
            FROM JSONB_TO_RECORDSET($1::JSONB)
              AS usuario_cancelado(
                id BIGINT,
                whatsapp VARCHAR(13),
                cliente_ativo BOOLEAN,
                profissional_ativo BOOLEAN,
                marketing_ativo BOOLEAN
              )
            CROSS JOIN LATERAL (
              VALUES
                (
                  usuario_cancelado.cliente_ativo,
                  'OPERACIONAL_CLIENTE'
                ),
                (
                  usuario_cancelado.profissional_ativo,
                  'OPERACIONAL_PROFISSIONAL'
                ),
                (
                  usuario_cancelado.marketing_ativo,
                  'MARKETING_PROFISSIONAL'
                )
            ) AS preferencia(ativa, escopo)
            WHERE preferencia.ativa
          `,
          [JSON.stringify(usuarios.rows)]
        );
      }

      const agendamentos =
        await executor.query(
          `
            WITH revogados AS (
              UPDATE agendamentos agendamento
              SET
                whatsapp_consentido_em = NULL
              WHERE agendamento.whatsapp_consentido_em
                  IS NOT NULL
                AND REGEXP_REPLACE(
                  agendamento.cliente_whatsapp,
                  '[^0-9]',
                  '',
                  'g'
                ) = ANY(
                  ARRAY[
                    $1,
                    '55' || $1
                  ]::TEXT[]
                )
              RETURNING
                agendamento.id,
                agendamento.cliente_id,
                $1::VARCHAR AS telefone
            )
            INSERT INTO whatsapp_consentimentos (
              usuario_id,
              agendamento_id,
              telefone,
              escopo,
              acao,
              origem,
              texto_versao
            )
            SELECT
              revogado.cliente_id,
              revogado.id,
              revogado.telefone,
              'OPERACIONAL_CLIENTE',
              'CANCELADO',
              'WHATSAPP',
              'optout-global-agendamento-v1'
            FROM revogados revogado
            RETURNING agendamento_id
          `,
          [telefoneNacional]
        );

      const mensagens =
        await executor.query(
          `
            UPDATE whatsapp_mensagens
            SET
              status = 'CANCELED',
              bloqueado_em = NULL,
              ultimo_erro =
                'Mensagens canceladas pelo destinatário no WhatsApp.'
            WHERE destinatario = ANY($1::VARCHAR[])
              AND status IN (
                'PENDING',
                'FAILED',
                'PROCESSING'
              )
            RETURNING id
          `,
          [[
            telefoneNacional,
            `55${telefoneNacional}`,
          ]]
        );

      return {
        usuarios:
          usuarios.rowCount || 0,
        agendamentos:
          agendamentos.rowCount || 0,
        mensagensCanceladas:
          mensagens.rowCount || 0,
      };
    }
  );
}

async function registrarInteracaoRecebida({
  metaMessageId,
  telefone,
  intencao,
  recebidoEm = new Date(),
}) {
  const result =
    await db.query(
      `
        INSERT INTO whatsapp_interacoes_recebidas (
          meta_message_id,
          telefone,
          intencao,
          recebido_em
        )

        VALUES (
          $1,
          $2,
          $3,
          $4
        )

        ON CONFLICT (
          meta_message_id
        )
        DO NOTHING

        RETURNING *
      `,
      [
        metaMessageId,
        String(telefone || "")
          .replace(/\D/g, ""),
        intencao,
        recebidoEm,
      ]
    );

  return result.rows[0] || null;
}

async function marcarInteracaoRespondida(
  interacaoId,
  metaMessageId
) {
  const result =
    await db.query(
      `
        UPDATE whatsapp_interacoes_recebidas

        SET
          status = 'RESPONDIDA',
          respondido_em = NOW(),
          resposta_meta_message_id = $2,
          ultimo_erro = NULL

        WHERE id = $1

        RETURNING *
      `,
      [
        interacaoId,
        metaMessageId || null,
      ]
    );

  return result.rows[0] || null;
}

async function marcarInteracaoSemResposta(
  interacaoId
) {
  const result =
    await db.query(
      `
        UPDATE whatsapp_interacoes_recebidas

        SET
          status = 'SEM_RESPOSTA',
          ultimo_erro = NULL

        WHERE id = $1

        RETURNING *
      `,
      [interacaoId]
    );

  return result.rows[0] || null;
}

async function marcarInteracaoFalha(
  interacaoId,
  erro
) {
  const result =
    await db.query(
      `
        UPDATE whatsapp_interacoes_recebidas

        SET
          status = 'FALHA',
          ultimo_erro = $2

        WHERE id = $1

        RETURNING *
      `,
      [
        interacaoId,
        String(
          erro ||
          "Falha ao responder pelo WhatsApp."
        ).slice(0, 2000),
      ]
    );

  return result.rows[0] || null;
}

async function marcarEnviada(
  mensagemId,
  metaMessageId
) {
  const result =
    await db.query(
      `
        UPDATE whatsapp_mensagens

        SET
          status = 'SENT',
          status_entrega =
            'ACCEPTED',
          status_entrega_em =
            NULL,
          enviado_em = NOW(),
          meta_message_id = $2,
          bloqueado_em = NULL,
          ultimo_erro = NULL

        WHERE id = $1
          AND status =
            'PROCESSING'

        RETURNING *
      `,
      [
        mensagemId,
        metaMessageId || null,
      ]
    );

  return result.rows[0] || null;
}

async function marcarFalha(
  mensagem,
  erro,
  atrasoSegundos,
  retentavel = true
) {
  const esgotada =
    !retentavel ||
    Number(mensagem.tentativas) >=
    Number(mensagem.max_tentativas);

  const result =
    await db.query(
      `
        UPDATE whatsapp_mensagens

        SET
          status = 'FAILED',
          falha_retentavel = $5,
          tentativas =
            CASE
              WHEN $5::BOOLEAN
                THEN tentativas
              ELSE max_tentativas
            END,
          bloqueado_em = NULL,
          ultimo_erro = $2,
          proxima_tentativa_em =
            CASE
              WHEN $3::BOOLEAN
                THEN proxima_tentativa_em
              ELSE
                NOW() +
                MAKE_INTERVAL(
                  secs => $4
                )
            END

        WHERE id = $1

        RETURNING *
      `,
      [
        mensagem.id,
        String(
          erro ||
          "Falha desconhecida."
        ).slice(
          0,
          2000
        ),
        esgotada,
        atrasoSegundos,
        retentavel,
      ]
    );

  return result.rows[0] || null;
}

async function registrarStatusEntrega({
  metaMessageId,
  status,
  ocorridoEm,
  codigoErro = null,
  tituloErro = null,
}) {
  const statusNormalizado =
    String(
      status ||
      ""
    ).toUpperCase();

  if (
    ![
      "SENT",
      "DELIVERED",
      "READ",
      "FAILED",
    ].includes(
      statusNormalizado
    )
  ) {
    return null;
  }

  const result =
    await db.query(
      `
        UPDATE whatsapp_mensagens

        SET
          status_entrega = $2,
          status_entrega_em = $3,
          entregue_em =
            CASE
              WHEN $2 IN (
                'DELIVERED',
                'READ'
              )
                THEN COALESCE(
                  entregue_em,
                  $3
                )
              ELSE entregue_em
            END,
          lida_em =
            CASE
              WHEN $2 = 'READ'
                THEN COALESCE(
                  lida_em,
                  $3
                )
              ELSE lida_em
            END,
          falhou_em =
            CASE
              WHEN $2 = 'FAILED'
                THEN COALESCE(
                  falhou_em,
                  $3
                )
              ELSE falhou_em
            END,
          meta_codigo_erro =
            CASE
              WHEN $2 = 'FAILED'
                THEN $4
              ELSE meta_codigo_erro
            END,
          ultimo_erro =
            CASE
              WHEN $2 = 'FAILED'
                THEN COALESCE(
                  $5,
                  ultimo_erro
                )
              ELSE ultimo_erro
            END

        WHERE meta_message_id = $1
          AND (
            status_entrega_em IS NULL
            OR $3 > status_entrega_em
            OR (
              $3 = status_entrega_em
              AND CASE $2
                WHEN 'SENT' THEN 1
                WHEN 'DELIVERED' THEN 2
                WHEN 'READ' THEN 3
                WHEN 'FAILED' THEN 4
                ELSE 0
              END >=
              CASE status_entrega
                WHEN 'ACCEPTED' THEN 0
                WHEN 'SENT' THEN 1
                WHEN 'DELIVERED' THEN 2
                WHEN 'READ' THEN 3
                WHEN 'FAILED' THEN 4
                ELSE 0
              END
            )
          )

        RETURNING *
      `,
      [
        metaMessageId,
        statusNormalizado,
        ocorridoEm,
        codigoErro
          ? String(codigoErro)
          : null,
        tituloErro
          ? String(tituloErro)
              .slice(0, 2000)
          : null,
      ]
    );

  return result.rows[0] || null;
}

async function marcarCancelada(
  mensagemId,
  motivo
) {
  const result =
    await db.query(
      `
        UPDATE whatsapp_mensagens

        SET
          status = 'CANCELED',
          bloqueado_em = NULL,
          ultimo_erro = $2

        WHERE id = $1

        RETURNING *
      `,
      [
        mensagemId,
        motivo || null,
      ]
    );

  return result.rows[0] || null;
}

module.exports = {
  enfileirarNovoAgendamento,
  enfileirarCancelamento,
  enfileirarLembretesDiariosNegocios,
  reservarProximaMensagem,
  mensagemContinuaValida,
  cancelarMensagensExpiradas,
  cancelarMarketingPorWhatsapp,
  cancelarTodasComunicacoesPorWhatsapp,
  registrarInteracaoRecebida,
  marcarInteracaoRespondida,
  marcarInteracaoSemResposta,
  marcarInteracaoFalha,
  marcarEnviada,
  marcarFalha,
  marcarCancelada,
  registrarStatusEntrega,
};
