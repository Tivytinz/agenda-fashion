BEGIN;

CREATE INDEX IF NOT EXISTS
  assinaturas_canceladas_expiracao_idx
ON assinaturas (
  data_proxima_cobranca,
  negocio_id
)
WHERE ativo = TRUE
  AND status IN ('CANCELED', 'CANCELLED')
  AND data_proxima_cobranca IS NOT NULL;

COMMIT;
