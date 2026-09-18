-- Introduz a entidade interna Client sem alterar o significado legado de
-- agendamentos.cliente_id, que continua representando a conta autenticada.
-- Todo booking passa a possuir agendamentos.client_id -> clientes.id.

CREATE TABLE IF NOT EXISTS clientes (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  usuario_id BIGINT,

  nome VARCHAR(120)
    NOT NULL,

  whatsapp_normalizado VARCHAR(13)
    NOT NULL,

  origem VARCHAR(20)
    NOT NULL,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT clientes_usuario_fk
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  CONSTRAINT clientes_usuario_unique
    UNIQUE (usuario_id),

  CONSTRAINT clientes_nome_valido
    CHECK (
      CHAR_LENGTH(BTRIM(nome))
      BETWEEN 2 AND 120
    ),

  CONSTRAINT clientes_whatsapp_valido
    CHECK (
      whatsapp_normalizado ~ '^[0-9]{10,13}$'
    ),

  CONSTRAINT clientes_origem_valida
    CHECK (
      origem IN ('conta', 'visitante')
    )
);

CREATE INDEX IF NOT EXISTS
  clientes_whatsapp_idx
ON clientes (
  whatsapp_normalizado
);

DROP TRIGGER IF EXISTS
  clientes_atualizar_updated_at
ON clientes;

CREATE TRIGGER
  clientes_atualizar_updated_at
BEFORE UPDATE
ON clientes
FOR EACH ROW
EXECUTE FUNCTION
  atualizar_updated_at();

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS client_id BIGINT;

-- Contas autenticadas: uma entidade Client por usuario.
INSERT INTO clientes (
  usuario_id,
  nome,
  whatsapp_normalizado,
  origem
)
SELECT DISTINCT
  u.id,
  u.nome,
  u.whatsapp,
  'conta'
FROM agendamentos a
INNER JOIN usuarios u
  ON u.id = a.cliente_id
WHERE a.cliente_id IS NOT NULL
ON CONFLICT (usuario_id)
DO UPDATE SET
  nome = EXCLUDED.nome,
  whatsapp_normalizado =
    EXCLUDED.whatsapp_normalizado,
  origem = 'conta';

UPDATE agendamentos a
SET client_id = c.id
FROM clientes c
WHERE a.cliente_id IS NOT NULL
  AND c.usuario_id = a.cliente_id
  AND a.client_id IS NULL;

-- Visitantes legados: uma identidade por booking é a política de backfill
-- mais conservadora; não funde pessoas somente pelo telefone.
DO $$
DECLARE
  item RECORD;
  novo_client_id BIGINT;
BEGIN
  FOR item IN
    SELECT
      id,
      cliente_nome,
      REGEXP_REPLACE(
        cliente_whatsapp,
        '[^0-9]',
        '',
        'g'
      ) AS whatsapp
    FROM agendamentos
    WHERE client_id IS NULL
      AND cliente_id IS NULL
    ORDER BY id
  LOOP
    INSERT INTO clientes (
      usuario_id,
      nome,
      whatsapp_normalizado,
      origem
    )
    VALUES (
      NULL,
      BTRIM(item.cliente_nome),
      item.whatsapp,
      'visitante'
    )
    RETURNING id
    INTO novo_client_id;

    UPDATE agendamentos
    SET client_id = novo_client_id
    WHERE id = item.id;
  END LOOP;
END;
$$;

-- Compatibilidade de rollout: inserts legados que ainda não informem
-- client_id recebem uma entidade Client dentro da mesma transação.
CREATE OR REPLACE FUNCTION
  preencher_client_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  client_encontrado BIGINT;
  whatsapp_normalizado TEXT;
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.cliente_id IS NOT NULL THEN
    INSERT INTO clientes (
      usuario_id,
      nome,
      whatsapp_normalizado,
      origem
    )
    SELECT
      u.id,
      u.nome,
      u.whatsapp,
      'conta'
    FROM usuarios u
    WHERE u.id = NEW.cliente_id
    ON CONFLICT (usuario_id)
    DO UPDATE SET
      nome = EXCLUDED.nome,
      whatsapp_normalizado =
        EXCLUDED.whatsapp_normalizado,
      origem = 'conta'
    RETURNING id
    INTO client_encontrado;
  ELSE
    whatsapp_normalizado =
      REGEXP_REPLACE(
        COALESCE(
          NEW.cliente_whatsapp,
          ''
        ),
        '[^0-9]',
        '',
        'g'
      );

    INSERT INTO clientes (
      usuario_id,
      nome,
      whatsapp_normalizado,
      origem
    )
    VALUES (
      NULL,
      BTRIM(NEW.cliente_nome),
      whatsapp_normalizado,
      'visitante'
    )
    RETURNING id
    INTO client_encontrado;
  END IF;

  NEW.client_id = client_encontrado;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  trg_preencher_client_agendamento
ON agendamentos;

CREATE TRIGGER
  trg_preencher_client_agendamento
BEFORE INSERT
ON agendamentos
FOR EACH ROW
EXECUTE FUNCTION
  preencher_client_agendamento();

ALTER TABLE agendamentos
  ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE agendamentos
  DROP CONSTRAINT IF EXISTS
    agendamentos_client_fk;

ALTER TABLE agendamentos
  ADD CONSTRAINT
    agendamentos_client_fk
  FOREIGN KEY (client_id)
  REFERENCES clientes(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS
  agendamentos_client_idx
ON agendamentos (
  client_id
);
