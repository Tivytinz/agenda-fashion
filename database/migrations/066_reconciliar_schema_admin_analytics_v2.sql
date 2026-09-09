BEGIN;

/*
 * Produções antigas podem ter sido incorporadas ao runner por baseline. Nessa
 * situação, registrar migrations históricas não garante que o schema legado
 * possua todos os campos que o runtime atual passou a considerar canônicos.
 *
 * Esta migration reconcilia apenas os contratos já existentes no código:
 * - negocios.primeira_publicacao_em, usado no funil de publicação;
 * - pagamentos.assinatura_id, usado pelo checkout, webhook e receita.
 *
 * Nenhuma migration antiga é reescrita e nenhum vínculo financeiro é
 * inventado para registros legados sem evidência persistida.
 */

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS primeira_publicacao_em TIMESTAMPTZ;

/*
 * Mantém o mesmo critério histórico da migration 032: para negócios que já
 * estavam publicados antes do marco existir, updated_at é a melhor evidência
 * persistida disponível.
 */
UPDATE negocios
SET primeira_publicacao_em = updated_at
WHERE publicado = TRUE
  AND primeira_publicacao_em IS NULL;

CREATE OR REPLACE FUNCTION
  marketing_marcar_primeira_publicacao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.publicado = TRUE
    AND COALESCE(OLD.publicado, FALSE) = FALSE
    AND NEW.primeira_publicacao_em IS NULL
  THEN
    NEW.primeira_publicacao_em = NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  marketing_primeira_publicacao_trigger
ON negocios;

CREATE TRIGGER
  marketing_primeira_publicacao_trigger
BEFORE UPDATE OF publicado
ON negocios
FOR EACH ROW
EXECUTE FUNCTION
  marketing_marcar_primeira_publicacao();

ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS assinatura_id INTEGER;

/*
 * Restaura a FK esperada pela migration 014 sem duplicá-la em bancos que já
 * estão íntegros. NULL permanece temporariamente permitido somente quando
 * existem pagamentos legados sem vínculo recuperável.
 */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    INNER JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_catalog = tc.constraint_catalog
      AND kcu.constraint_schema = tc.constraint_schema
      AND kcu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = current_schema()
      AND tc.table_name = 'pagamentos'
      AND kcu.column_name = 'assinatura_id'
  ) THEN
    ALTER TABLE pagamentos
      ADD CONSTRAINT pagamentos_assinatura_id_fkey
      FOREIGN KEY (assinatura_id)
      REFERENCES assinaturas(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_pagamentos_assinatura
  ON pagamentos (assinatura_id, created_at DESC);

/*
 * Se o banco não possui legado órfão, recupera o NOT NULL canônico. Havendo
 * registros antigos sem associação comprovada, não inventamos o vínculo:
 * preservamos as linhas e usamos um CHECK NOT VALID, que bloqueia novos NULLs
 * sem invalidar o histórico existente.
 */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pagamentos
    WHERE assinatura_id IS NULL
  ) THEN
    ALTER TABLE pagamentos
      ALTER COLUMN assinatura_id SET NOT NULL;

    ALTER TABLE pagamentos
      DROP CONSTRAINT IF EXISTS pagamentos_assinatura_id_required;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'pagamentos'::regclass
      AND conname = 'pagamentos_assinatura_id_required'
  ) THEN
    ALTER TABLE pagamentos
      ADD CONSTRAINT pagamentos_assinatura_id_required
      CHECK (assinatura_id IS NOT NULL) NOT VALID;
  END IF;
END;
$$;

COMMIT;
