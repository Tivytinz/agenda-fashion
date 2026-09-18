BEGIN;

-- Preserva a origem rastreável dos links gerados pelo próprio Agenda Fashion
-- sem misturá-la com identificadores publicitários de terceiros.
ALTER TABLE marketing_sessao_evidencias
  ADD COLUMN IF NOT EXISTS af_source VARCHAR(80),
  ADD COLUMN IF NOT EXISTS af_medium VARCHAR(80),
  ADD COLUMN IF NOT EXISTS af_content VARCHAR(140);

-- Cada retomada de uma tentativa de checkout recebe uma versão nova.
-- Finalizações antigas precisam informar a mesma versão para não sobrescrever
-- uma execução mais recente.
ALTER TABLE checkout_tentativas
  ADD COLUMN IF NOT EXISTS execucao_versao INTEGER NOT NULL DEFAULT 1;

ALTER TABLE checkout_tentativas
  DROP CONSTRAINT IF EXISTS checkout_tentativas_execucao_versao_valida;

ALTER TABLE checkout_tentativas
  ADD CONSTRAINT checkout_tentativas_execucao_versao_valida
  CHECK (execucao_versao > 0);

COMMENT ON COLUMN marketing_sessao_evidencias.af_source IS
  'Origem first-party do próprio AF, separada de UTM e click IDs publicitários.';

COMMENT ON COLUMN marketing_sessao_evidencias.af_medium IS
  'Meio first-party do link AF, por exemplo share, copy, whatsapp ou qr.';

COMMENT ON COLUMN marketing_sessao_evidencias.af_content IS
  'Contexto first-party do link AF, por exemplo negocio ou servico.';

COMMENT ON COLUMN checkout_tentativas.execucao_versao IS
  'Versão monotônica da execução usada como fencing contra finalizações obsoletas.';

COMMIT;
