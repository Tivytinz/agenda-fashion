BEGIN;

-- Evidência própria de divulgação: não substitui UTM, click IDs ou conversão paga.
ALTER TABLE marketing_sessao_evidencias
  ADD COLUMN IF NOT EXISTS af_source VARCHAR(80),
  ADD COLUMN IF NOT EXISTS af_medium VARCHAR(80),
  ADD COLUMN IF NOT EXISTS af_content VARCHAR(140);

COMMENT ON COLUMN marketing_sessao_evidencias.af_source IS
  'Origem declarada pelo link AF; não comprova causalidade nem campanha paga.';
COMMENT ON COLUMN marketing_sessao_evidencias.af_medium IS
  'Meio declarado pelo link AF (por exemplo, share ou whatsapp).';
COMMENT ON COLUMN marketing_sessao_evidencias.af_content IS
  'Contexto declarado pelo link AF (por exemplo, negocio ou servico).';

COMMIT;
