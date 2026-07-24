BEGIN;

ALTER TABLE planos
  ADD COLUMN IF NOT EXISTS limite_profissionais INTEGER,
  ADD COLUMN IF NOT EXISTS limite_servicos INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'planos_limite_profissionais_valido'
  ) THEN
    ALTER TABLE planos
      ADD CONSTRAINT planos_limite_profissionais_valido
      CHECK (
        limite_profissionais IS NULL
        OR limite_profissionais > 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'planos_limite_servicos_valido'
  ) THEN
    ALTER TABLE planos
      ADD CONSTRAINT planos_limite_servicos_valido
      CHECK (
        limite_servicos IS NULL
        OR limite_servicos > 0
      );
  END IF;
END
$$;

/*
 * Mantém o slug interno "inicial" para preservar o trigger
 * e os negócios que já utilizam o plano gratuito.
 */
UPDATE planos
SET
  nome = 'Grátis',
  valor = 0.00,
  capacidade_agendamentos = 10,
  limite_profissionais = 1,
  limite_servicos = 2,
  destaque = FALSE,
  ativo = TRUE,
  updated_at = NOW()
WHERE slug = 'inicial';

INSERT INTO planos (
  nome,
  slug,
  valor,
  capacidade_agendamentos,
  limite_profissionais,
  limite_servicos,
  destaque,
  ativo
)
VALUES
  (
    'Autônoma',
    'autonoma',
    49.90,
    20,
    1,
    4,
    FALSE,
    TRUE
  ),
  (
    'Studio',
    'studio',
    99.90,
    30,
    1,
    10,
    TRUE,
    TRUE
  ),
  (
    'Salão',
    'salao',
    199.90,
    NULL,
    5,
    NULL,
    FALSE,
    TRUE
  )
ON CONFLICT (slug)
DO UPDATE SET
  nome = EXCLUDED.nome,
  valor = EXCLUDED.valor,
  capacidade_agendamentos = EXCLUDED.capacidade_agendamentos,
  limite_profissionais = EXCLUDED.limite_profissionais,
  limite_servicos = EXCLUDED.limite_servicos,
  destaque = EXCLUDED.destaque,
  ativo = EXCLUDED.ativo,
  updated_at = NOW();

COMMIT;
