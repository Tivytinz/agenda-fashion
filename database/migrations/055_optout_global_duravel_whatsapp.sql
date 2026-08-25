BEGIN;

CREATE INDEX IF NOT EXISTS
  whatsapp_interacoes_optout_telefone_idx
ON whatsapp_interacoes_recebidas (
  (
    CASE
      WHEN telefone ~ '^55[0-9]{10,11}$'
        THEN SUBSTRING(
          telefone
          FROM 3
        )
      ELSE telefone
    END
  ),
  recebido_em DESC
)
WHERE intencao = 'GLOBAL_OPTOUT';

/*
 * O opt-out global já cancelava preferências da conta e itens existentes na
 * fila, mas o consentimento gravado em agendamentos de visitantes permanecia
 * ativo. Revogamos somente consentimentos anteriores ao último pedido SAIR;
 * uma autorização nova, concedida depois do opt-out, continua válida.
 */
WITH optouts_normalizados AS (
  SELECT
    CASE
      WHEN REGEXP_REPLACE(
        telefone,
        '[^0-9]',
        '',
        'g'
      ) ~ '^55[0-9]{10,11}$'
        THEN SUBSTRING(
          REGEXP_REPLACE(
            telefone,
            '[^0-9]',
            '',
            'g'
          )
          FROM 3
        )
      WHEN REGEXP_REPLACE(
        telefone,
        '[^0-9]',
        '',
        'g'
      ) ~ '^[0-9]{10,11}$'
        THEN REGEXP_REPLACE(
          telefone,
          '[^0-9]',
          '',
          'g'
        )
      ELSE NULL
    END AS telefone,
    recebido_em
  FROM whatsapp_interacoes_recebidas
  WHERE intencao = 'GLOBAL_OPTOUT'
),
ultimos_optouts AS (
  SELECT
    telefone,
    MAX(recebido_em) AS recebido_em
  FROM optouts_normalizados
  WHERE telefone IS NOT NULL
  GROUP BY telefone
),
revogados AS (
  UPDATE agendamentos agendamento
  SET
    whatsapp_consentido_em = NULL
  FROM ultimos_optouts optout
  WHERE agendamento.whatsapp_consentido_em
      IS NOT NULL
    AND agendamento.whatsapp_consentido_em
      <= optout.recebido_em
    AND REGEXP_REPLACE(
      agendamento.cliente_whatsapp,
      '[^0-9]',
      '',
      'g'
    ) = ANY(
      ARRAY[
        optout.telefone,
        '55' || optout.telefone
      ]
    )
  RETURNING
    agendamento.id,
    agendamento.cliente_id,
    CASE
      WHEN REGEXP_REPLACE(
        agendamento.cliente_whatsapp,
        '[^0-9]',
        '',
        'g'
      ) ~ '^55[0-9]{10,11}$'
        THEN SUBSTRING(
          REGEXP_REPLACE(
            agendamento.cliente_whatsapp,
            '[^0-9]',
            '',
            'g'
          )
          FROM 3
        )
      ELSE REGEXP_REPLACE(
        agendamento.cliente_whatsapp,
        '[^0-9]',
        '',
        'g'
      )
    END AS telefone
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
  'MIGRACAO',
  'optout-global-retroativo-v1'
FROM revogados revogado;

UPDATE whatsapp_mensagens mensagem
SET
  status = 'CANCELED',
  bloqueado_em = NULL,
  ultimo_erro =
    'Consentimento do agendamento revogado por opt-out global.'
WHERE mensagem.tipo IN (
    'CONFIRMACAO_AGENDAMENTO_CLIENTE',
    'LEMBRETE_AGENDAMENTO_CLIENTE',
    'CANCELAMENTO_AGENDAMENTO_CLIENTE'
  )
  AND mensagem.status IN (
    'PENDING',
    'FAILED',
    'PROCESSING'
  )
  AND EXISTS (
    SELECT 1
    FROM whatsapp_consentimentos consentimento
    WHERE consentimento.agendamento_id =
        mensagem.agendamento_id
      AND consentimento.origem = 'MIGRACAO'
      AND consentimento.texto_versao =
        'optout-global-retroativo-v1'
  );

COMMIT;
