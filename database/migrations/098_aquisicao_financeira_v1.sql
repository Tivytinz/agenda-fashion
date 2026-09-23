BEGIN;

INSERT INTO financeiro_marcos (
  chave,
  detalhes
)
VALUES (
  'aquisicao_financeira_v1_inicio',
  jsonb_build_object(
    'regra', 'aquisicao_financeira_v1',
    'unidade', 'negocio',
    'custo', 'midia_observada',
    'receita', 'bruta_observada',
    'janelas_dias', jsonb_build_array(30, 60, 90),
    'historico_anterior', 'nao_inferido',
    'payback_economico_disponivel', false
  )
)
ON CONFLICT (chave)
DO NOTHING;

CREATE TABLE marketing_negocio_aquisicoes (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  negocio_id BIGINT
    NOT NULL
    UNIQUE
    REFERENCES negocios(id)
    ON DELETE CASCADE,

  usuario_aquisicao_id BIGINT
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  campanha_oficial_id BIGINT
    REFERENCES marketing_campanhas(id)
    ON DELETE SET NULL,

  primeiro_pagamento_id BIGINT
    REFERENCES pagamentos(id)
    ON DELETE SET NULL,

  plano_entrada_id BIGINT
    REFERENCES planos(id)
    ON DELETE SET NULL,

  classificacao_atribuicao VARCHAR(40)
    NOT NULL,

  metodo_resolucao VARCHAR(40),

  origem VARCHAR(80)
    NOT NULL,

  midia VARCHAR(80)
    NOT NULL,

  campanha VARCHAR(140)
    NOT NULL,

  atribuicao_em TIMESTAMPTZ,

  primeira_conversao_em TIMESTAMPTZ
    NOT NULL,

  primeira_conversao_data DATE
    NOT NULL,

  detalhes JSONB
    NOT NULL
    DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT marketing_negocio_aquisicoes_classificacao_valida
    CHECK (
      classificacao_atribuicao IN (
        'oficial',
        'organico',
        'rastreamento_incompleto',
        'identidade_nao_oficial',
        'sem_evidencia'
      )
    ),

  CONSTRAINT marketing_negocio_aquisicoes_metodo_valido
    CHECK (
      metodo_resolucao IS NULL
      OR metodo_resolucao IN (
        'utm_exata',
        'vinculo_plataforma',
        'vinculo_unico'
      )
    ),

  CONSTRAINT marketing_negocio_aquisicoes_origem_valida
    CHECK (
      LENGTH(BTRIM(origem))
      BETWEEN 1 AND 80
    ),

  CONSTRAINT marketing_negocio_aquisicoes_midia_valida
    CHECK (
      LENGTH(BTRIM(midia))
      BETWEEN 1 AND 80
    ),

  CONSTRAINT marketing_negocio_aquisicoes_campanha_valida
    CHECK (
      LENGTH(BTRIM(campanha))
      BETWEEN 1 AND 140
    ),

  CONSTRAINT marketing_negocio_aquisicoes_cronologia_valida
    CHECK (
      atribuicao_em IS NULL
      OR primeira_conversao_em >= atribuicao_em
    )
);

CREATE INDEX
  marketing_negocio_aquisicoes_campanha_atribuicao_idx
ON marketing_negocio_aquisicoes (
  campanha_oficial_id,
  atribuicao_em
);

CREATE INDEX
  marketing_negocio_aquisicoes_conversao_idx
ON marketing_negocio_aquisicoes (
  primeira_conversao_em,
  negocio_id
);

CREATE INDEX
  marketing_negocio_aquisicoes_classificacao_idx
ON marketing_negocio_aquisicoes (
  classificacao_atribuicao,
  atribuicao_em
);

ALTER TABLE marketing_campanha_gastos
  ADD COLUMN objetivo_snapshot VARCHAR(24);

UPDATE marketing_campanha_gastos g
SET objetivo_snapshot = mc.objetivo
FROM marketing_campanhas mc
WHERE mc.id = g.campanha_id
  AND g.objetivo_snapshot IS NULL;

ALTER TABLE marketing_campanha_gastos
  ALTER COLUMN objetivo_snapshot
    SET NOT NULL,
  ADD CONSTRAINT marketing_campanha_gastos_objetivo_snapshot_valido
    CHECK (
      objetivo_snapshot IN (
        'indefinido',
        'profissional',
        'cliente'
      )
    );

CREATE OR REPLACE FUNCTION
  marketing_campanha_gastos_snapshot_objetivo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT objetivo
    INTO NEW.objetivo_snapshot
    FROM marketing_campanhas
    WHERE id = NEW.campanha_id;
  ELSE
    IF NEW.campanha_id IS DISTINCT FROM OLD.campanha_id
    THEN
      SELECT objetivo
      INTO NEW.objetivo_snapshot
      FROM marketing_campanhas
      WHERE id = NEW.campanha_id;
    END IF;
  END IF;

  IF NEW.objetivo_snapshot IS NULL THEN
    RAISE EXCEPTION
      'Campanha inválida para snapshot de objetivo.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  marketing_campanha_gastos_objetivo_snapshot_trigger
ON marketing_campanha_gastos;

CREATE TRIGGER
  marketing_campanha_gastos_objetivo_snapshot_trigger
BEFORE INSERT OR UPDATE OF campanha_id
ON marketing_campanha_gastos
FOR EACH ROW
EXECUTE FUNCTION
  marketing_campanha_gastos_snapshot_objetivo();

CREATE INDEX
  marketing_campanha_gastos_objetivo_data_idx
ON marketing_campanha_gastos (
  objetivo_snapshot,
  data_gasto,
  campanha_id
);

COMMENT ON COLUMN marketing_campanha_gastos.objetivo_snapshot IS
  'Objetivo da campanha no instante em que o custo diário foi persistido. Mudanças futuras em marketing_campanhas.objetivo não reclassificam silenciosamente o custo histórico.';

COMMENT ON TABLE marketing_negocio_aquisicoes IS
  'Snapshot imutável de aquisição financeira do negócio, materializado a partir da primeira conversão paga canônica posterior ao cutover da Wave 27.';

COMMENT ON COLUMN marketing_negocio_aquisicoes.usuario_aquisicao_id IS
  'Primeira conta que apareceu como dona do negócio; troca futura de proprietária não reescreve a aquisição histórica.';

COMMENT ON COLUMN marketing_negocio_aquisicoes.atribuicao_em IS
  'Timestamp first-touch persistido quando existe evidência válida anterior à conversão. Fica nulo quando a aquisição não possui evidência temporal confiável.';

COMMENT ON COLUMN marketing_negocio_aquisicoes.campanha_oficial_id IS
  'Campanha oficial resolvida no instante da materialização. O snapshot preserva a interpretação financeira mesmo se vínculos de marketing forem corrigidos depois.';

COMMENT ON COLUMN marketing_negocio_aquisicoes.primeiro_pagamento_id IS
  'Pagamento ligado à CONVERSAO_INICIAL canônica que consolidou o customer pago. Pode ficar nulo somente se o pagamento for removido posteriormente; a data canônica da conversão permanece no snapshot.';

COMMENT ON COLUMN marketing_negocio_aquisicoes.primeira_conversao_data IS
  'Data de pagamento persistida no snapshot para que a coorte financeira não dependa de reler a cobrança original.';

COMMIT;
