BEGIN;

ALTER TABLE assinaturas
  ADD COLUMN IF NOT EXISTS reativacao_inicio_cobranca DATE;

-- Ciclos já existentes mantêm a identidade de ledger anterior. Novas linhas e
-- a próxima reativação passam a identificar o cancelamento por geração.
ALTER TABLE assinaturas
  ADD COLUMN IF NOT EXISTS renovacao_chave_versao SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE assinaturas
  ALTER COLUMN renovacao_chave_versao SET DEFAULT 1;

ALTER TABLE assinaturas
  ADD CONSTRAINT assinaturas_renovacao_chave_versao_valida
  CHECK (renovacao_chave_versao IN (0, 1));

COMMENT ON COLUMN assinaturas.reativacao_inicio_cobranca IS
  'Dia congelado na reserva da tentativa de reativação; compõe a referência externa e não muda quando chega outro pagamento.';
COMMENT ON COLUMN assinaturas.renovacao_chave_versao IS
  '0 preserva chaves de cancelamento do ciclo legado; 1 identifica o fato por assinatura, recorrência e geração.';

COMMIT;
