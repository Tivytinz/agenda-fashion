const db = require("../db/db");

const TIPOS_ATIVOS = [
  "NOVO_AGENDAMENTO_PROFISSIONAL",
  "CONFIRMACAO_AGENDAMENTO_CLIENTE",
  "LEMBRETE_AGENDAMENTO_CLIENTE",
];

const TIPOS_CANCELAMENTO = [
  "CANCELAMENTO_AGENDAMENTO_PROFISSIONAL",
  "CANCELAMENTO_AGENDAMENTO_CLIENTE",
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

async function enfileirarNovoAgendamento(
  executor,
  agendamentoId,
  antecedenciaLembreteHoras = 24
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

            COALESCE(
              NULLIF(
                REGEXP_REPLACE(
                  profissional.whatsapp,
                  '[^0-9]',
                  '',
                  'g'
                ),
                ''
              ),
              REGEXP_REPLACE(
                n.whatsapp,
                '[^0-9]',
                '',
                'g'
              )
            ) AS profissional_whatsapp,

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
              cliente_nome,
              servico_nome,
              profissional_nome,
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

          UNION ALL

          SELECT
            agendamento_id,
            'CONFIRMACAO_AGENDAMENTO_CLIENTE',
            cliente_whatsapp,
            JSONB_BUILD_ARRAY(
              cliente_nome,
              negocio_nome,
              servico_nome,
              profissional_nome,
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
            'LEMBRETE_AGENDAMENTO_CLIENTE',
            cliente_whatsapp,
            JSONB_BUILD_ARRAY(
              cliente_nome,
              negocio_nome,
              servico_nome,
              profissional_nome,
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

            COALESCE(
              NULLIF(
                REGEXP_REPLACE(
                  profissional.whatsapp,
                  '[^0-9]',
                  '',
                  'g'
                ),
                ''
              ),
              REGEXP_REPLACE(
                n.whatsapp,
                '[^0-9]',
                '',
                'g'
              )
            ) AS profissional_whatsapp,

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
              cliente_nome,
              servico_nome,
              profissional_nome,
              data_formatada,
              horario_formatado
            ) AS parametros_corpo,
            NOW() +
              INTERVAL '2 hours'
              AS expira_em

          FROM dados

          WHERE profissional_whatsapp
            ~ '^[0-9]{10,13}$'

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

async function reservarProximaMensagem() {
  const result =
    await db.query(
      `
        WITH candidata AS (
          SELECT wm.id

          FROM whatsapp_mensagens wm

          JOIN agendamentos a
            ON a.id =
              wm.agendamento_id

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

          JOIN agendamentos a
            ON a.id =
              wm.agendamento_id

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
            )
        ) AS valida
      `,
      [
        mensagemId,
        TIPOS_ATIVOS,
        TIPOS_CANCELAMENTO,
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
  atrasoSegundos
) {
  const esgotada =
    Number(mensagem.tentativas) >=
    Number(mensagem.max_tentativas);

  const result =
    await db.query(
      `
        UPDATE whatsapp_mensagens

        SET
          status = 'FAILED',
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
  reservarProximaMensagem,
  mensagemContinuaValida,
  cancelarMensagensExpiradas,
  marcarEnviada,
  marcarFalha,
  marcarCancelada,
};
