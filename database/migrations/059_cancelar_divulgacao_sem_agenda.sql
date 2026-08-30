-- Cancela lembretes de divulgação criados antes do gate de agenda confirmada.
-- Novos lembretes já são impedidos pelo repositório quando nenhum profissional
-- ativo do negócio possui agenda_configuracoes.configurado_em preenchido.

UPDATE whatsapp_mensagens wm
SET
  status = 'CANCELED',
  bloqueado_em = NULL,
  ultimo_erro =
    'Mensagem cancelada porque o negócio ainda não possui agenda confirmada.'
WHERE wm.tipo = 'LEMBRETE_DIVULGAR_NEGOCIO'
  AND wm.status IN (
    'PENDING',
    'FAILED',
    'PROCESSING'
  )
  AND wm.negocio_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM usuarios_negocios un
    INNER JOIN agenda_configuracoes ac
      ON ac.profissional_id = un.usuario_id
    WHERE un.negocio_id = wm.negocio_id
      AND un.ativo = TRUE
      AND un.papel IN (
        'dono',
        'profissional'
      )
      AND ac.configurado_em IS NOT NULL
  );
