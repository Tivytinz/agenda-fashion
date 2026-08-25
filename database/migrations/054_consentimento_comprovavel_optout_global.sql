BEGIN;

ALTER TABLE whatsapp_consentimentos
  DROP CONSTRAINT IF EXISTS
    whatsapp_consentimentos_origem_check;

ALTER TABLE whatsapp_consentimentos
  ADD CONSTRAINT whatsapp_consentimentos_origem_check
  CHECK (
    origem IN (
      'CADASTRO',
      'MINHA_CONTA',
      'PAINEL',
      'AGENDAMENTO',
      'WHATSAPP',
      'MIGRACAO'
    )
  );

/*
 * A migration 046 manteve contas antigas autorizadas por compatibilidade,
 * mesmo sem uma ação explícita registrada. A política da Meta exige uma
 * evidência de opt-in. Preservamos somente autorizações cujo último evento
 * auditável para o escopo operacional da cliente seja CONSENTIDO.
 */
WITH consentimentos_sem_evidencia AS (
  SELECT
    usuario.id,
    usuario.whatsapp
  FROM usuarios usuario
  WHERE usuario.whatsapp_notificacoes_consentido_em
      IS NOT NULL
    AND usuario.whatsapp_notificacoes_cancelado_em
      IS NULL
    AND COALESCE(
      (
        SELECT consentimento.acao
        FROM whatsapp_consentimentos consentimento
        WHERE consentimento.usuario_id = usuario.id
          AND consentimento.agendamento_id IS NULL
          AND consentimento.escopo = 'OPERACIONAL_CLIENTE'
        ORDER BY
          consentimento.created_at DESC,
          consentimento.id DESC
        LIMIT 1
      ),
      ''
    ) <> 'CONSENTIDO'
),
usuarios_atualizados AS (
  UPDATE usuarios usuario
  SET
    whatsapp_notificacoes_consentido_em = NULL,
    whatsapp_notificacoes_cancelado_em = NOW()
  FROM consentimentos_sem_evidencia legado
  WHERE usuario.id = legado.id
  RETURNING
    usuario.id,
    usuario.whatsapp
)
INSERT INTO whatsapp_consentimentos (
  usuario_id,
  telefone,
  escopo,
  acao,
  origem,
  texto_versao
)
SELECT
  usuario.id,
  usuario.whatsapp,
  'OPERACIONAL_CLIENTE',
  'CANCELADO',
  'MIGRACAO',
  'revogacao-sem-evidencia-v1'
FROM usuarios_atualizados usuario;

UPDATE whatsapp_mensagens mensagem
SET
  status = 'CANCELED',
  bloqueado_em = NULL,
  ultimo_erro =
    'Consentimento legado sem evidência foi revogado.'
FROM agendamentos agendamento
INNER JOIN usuarios cliente
  ON cliente.id = agendamento.cliente_id
WHERE mensagem.agendamento_id = agendamento.id
  AND mensagem.tipo IN (
    'CONFIRMACAO_AGENDAMENTO_CLIENTE',
    'LEMBRETE_AGENDAMENTO_CLIENTE',
    'CANCELAMENTO_AGENDAMENTO_CLIENTE'
  )
  AND mensagem.status IN (
    'PENDING',
    'FAILED',
    'PROCESSING'
  )
  AND (
    cliente.whatsapp_notificacoes_consentido_em
      IS NULL
    OR cliente.whatsapp_notificacoes_cancelado_em
      IS NOT NULL
  );

ALTER TABLE whatsapp_interacoes_recebidas
  DROP CONSTRAINT IF EXISTS
    whatsapp_interacoes_intencao_check;

ALTER TABLE whatsapp_interacoes_recebidas
  ADD CONSTRAINT whatsapp_interacoes_intencao_check
  CHECK (
    intencao IN (
      'COMO_FUNCIONA',
      'CRIAR_AGENDA',
      'PLANOS',
      'AJUDA',
      'MARKETING_OPTOUT',
      'GLOBAL_OPTOUT'
    )
  );

COMMIT;
