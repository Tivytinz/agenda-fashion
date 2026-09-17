BEGIN;

CREATE INDEX IF NOT EXISTS
  webhook_eventos_retencao_idx
ON webhook_eventos(processado_em)
WHERE status IN (
  'PROCESSED',
  'IGNORED'
)
  AND (
    payload IS NOT NULL
    OR erro IS NOT NULL
  );

COMMIT;
