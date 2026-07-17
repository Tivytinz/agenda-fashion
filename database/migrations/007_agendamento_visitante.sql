BEGIN;

ALTER TABLE agendamentos
  ALTER COLUMN cliente_id
  DROP NOT NULL;

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS
    cliente_nome VARCHAR(120);

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS
    cliente_whatsapp VARCHAR(20);

UPDATE agendamentos a
SET
  cliente_nome = COALESCE(
    NULLIF(
      BTRIM(a.cliente_nome),
      ''
    ),
    u.nome
  ),

  cliente_whatsapp = COALESCE(
    NULLIF(
      BTRIM(a.cliente_whatsapp),
      ''
    ),
    u.whatsapp
  )

FROM usuarios u

WHERE a.cliente_id = u.id
  AND (
    a.cliente_nome IS NULL
    OR BTRIM(a.cliente_nome) = ''
    OR a.cliente_whatsapp IS NULL
    OR BTRIM(a.cliente_whatsapp) = ''
  );

ALTER TABLE agendamentos
  DROP CONSTRAINT IF EXISTS
    agendamentos_cliente_identificacao_check;

ALTER TABLE agendamentos
  ADD CONSTRAINT
    agendamentos_cliente_identificacao_check
  CHECK (
    cliente_id IS NOT NULL
    OR (
      cliente_nome IS NOT NULL
      AND CHAR_LENGTH(
        BTRIM(cliente_nome)
      ) BETWEEN 2 AND 120

      AND cliente_whatsapp IS NOT NULL
      AND CHAR_LENGTH(
        REGEXP_REPLACE(
          cliente_whatsapp,
          '[^0-9]',
          '',
          'g'
        )
      ) BETWEEN 10 AND 13
    )
  );

CREATE INDEX IF NOT EXISTS
  agendamentos_cliente_whatsapp_idx
ON agendamentos (
  cliente_whatsapp
);

COMMIT;