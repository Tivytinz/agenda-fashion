const db = require("../db/db");
const {
  TIPOS_ATIVOS,
  TIPOS_CANCELAMENTO,
  TIPOS_NEGOCIO,
  TIPOS_CLIENTE,
  TIPOS_PROFISSIONAL,
} = require("./whatsappMensagemRepositoryConfig");

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

module.exports = {
  reservarProximaMensagem,
  mensagemContinuaValida,
};
