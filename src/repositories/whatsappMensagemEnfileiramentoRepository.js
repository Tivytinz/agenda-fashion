const db = require("../db/db");
const {
  TIPOS_ATIVOS,
  validarExecutor,
} = require("./whatsappMensagemRepositoryConfig");

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

async function enfileirarReagendamento(
  executor,
  agendamentoId,
  antecedenciaLembreteHoras = 24,
  lembreteProfissionalAtivo = false
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
          'Mensagem substituída por reagendamento do compromisso.'

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

            profissional.nome
              AS profissional_nome,

            n.nome
              AS negocio_nome,

            COALESCE(
              NULLIF(
                BTRIM(a.servico_nome),
                ''
              ),
              s.nome,
              'Serviço'
            ) AS servico_nome,

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
              COALESCE(
                NULLIF(
                  n.fuso_horario,
                  ''
                ),
                'America/Sao_Paulo'
              )
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
            ~ '^[0-9]{10,13}
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

module.exports = {
  enfileirarNovoAgendamento,
  enfileirarReagendamento,
  enfileirarCancelamento,
  enfileirarLembretesDiariosNegocios,
};

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
            ~ '^[0-9]{10,13}
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

module.exports = {
  enfileirarNovoAgendamento,
  enfileirarCancelamento,
  enfileirarLembretesDiariosNegocios,
};

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
            ~ '^[0-9]{10,13}
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

module.exports = {
  enfileirarNovoAgendamento,
  enfileirarCancelamento,
  enfileirarLembretesDiariosNegocios,
};

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
            ~ '^[0-9]{10,13}
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

module.exports = {
  enfileirarNovoAgendamento,
  enfileirarCancelamento,
  enfileirarLembretesDiariosNegocios,
};

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
          proxima_tentativa_em,
          status,
          tentativas,
          bloqueado_em,
          enviado_em,
          meta_message_id,
          ultimo_erro
        )

        SELECT
          agendamento_id,
          tipo,
          destinatario,
          parametros_corpo,
          agendado_para,
          expira_em,
          agendado_para,
          'PENDING',
          0,
          NULL,
          NULL,
          NULL,
          NULL

        FROM mensagens

        ON CONFLICT (
          agendamento_id,
          tipo,
          destinatario
        )
        DO UPDATE SET
          parametros_corpo =
            EXCLUDED.parametros_corpo,
          agendado_para =
            EXCLUDED.agendado_para,
          expira_em =
            EXCLUDED.expira_em,
          proxima_tentativa_em =
            EXCLUDED.proxima_tentativa_em,
          status = 'PENDING',
          tentativas = 0,
          bloqueado_em = NULL,
          enviado_em = NULL,
          meta_message_id = NULL,
          ultimo_erro = NULL

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

module.exports = {
  enfileirarNovoAgendamento,
  enfileirarReagendamento,
  enfileirarCancelamento,
  enfileirarLembretesDiariosNegocios,
};
