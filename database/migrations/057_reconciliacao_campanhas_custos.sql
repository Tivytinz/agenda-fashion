BEGIN;

ALTER TABLE marketing_custo_sincronizacoes
  ADD COLUMN reconciliacao_campanhas_completa BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN
  marketing_custo_sincronizacoes.reconciliacao_campanhas_completa IS
  'Confirma que a execução auditou todas as campanhas externas operacionais, inclusive as sem gasto. Registros anteriores permanecem falsos e não comprovam atribuição assistida.';

COMMIT;
