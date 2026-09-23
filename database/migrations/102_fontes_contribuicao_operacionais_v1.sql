BEGIN;

INSERT INTO financeiro_marcos (
  chave,
  detalhes
)
VALUES (
  'fontes_contribuicao_v1_inicio',
  jsonb_build_object(
    'regra', 'fontes_contribuicao_operacionais_v1',
    'unidade', 'negocio',
    'escrita', 'superadmin',
    'historico_anterior', 'nao_inferido',
    'fonte_seed', false,
    'correcao', 'credito_append_only',
    'cobertura', 'watermark_monotono',
    'lucro_disponivel', false,
    'cac_total_disponivel', false
  )
)
ON CONFLICT (chave)
DO NOTHING;

CREATE TABLE contribuicao_operacoes_admin (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  usuario_id BIGINT
    REFERENCES usuarios(id)
    ON DELETE SET NULL,

  fonte_id BIGINT
    REFERENCES contribuicao_fontes(id)
    ON DELETE SET NULL,

  negocio_id BIGINT
    REFERENCES negocios(id)
    ON DELETE SET NULL,

  custo_id BIGINT
    REFERENCES contribuicao_custos(id)
    ON DELETE SET NULL,

  acao VARCHAR(40)
    NOT NULL,

  motivo VARCHAR(240)
    NOT NULL,

  detalhes JSONB
    NOT NULL
    DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT contribuicao_operacoes_admin_acao_valida
    CHECK (
      acao IN (
        'CRIAR_FONTE',
        'REGISTRAR_CUSTO',
        'REGISTRAR_CREDITO',
        'ATUALIZAR_COBERTURA'
      )
    ),

  CONSTRAINT contribuicao_operacoes_admin_motivo_valido
    CHECK (
      LENGTH(TRIM(motivo)) BETWEEN 4 AND 240
    )
);

CREATE INDEX
  contribuicao_operacoes_admin_fonte_data_idx
ON contribuicao_operacoes_admin (
  fonte_id,
  created_at DESC,
  id DESC
);

CREATE INDEX
  contribuicao_operacoes_admin_negocio_data_idx
ON contribuicao_operacoes_admin (
  negocio_id,
  created_at DESC,
  id DESC
);

CREATE OR REPLACE FUNCTION
  bloquear_mutacao_contribuicao_operacoes_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'contribuicao_operacoes_admin e append-only';
END;
$$;

CREATE TRIGGER
  contribuicao_operacoes_admin_append_only
BEFORE UPDATE OR DELETE
ON contribuicao_operacoes_admin
FOR EACH ROW
EXECUTE FUNCTION
  bloquear_mutacao_contribuicao_operacoes_admin();

COMMENT ON TABLE contribuicao_operacoes_admin IS
  'Trilha append-only das operacoes administrativas que criam fonte, registram custo/credito ou avancam cobertura de contribuicao.';

COMMENT ON COLUMN contribuicao_operacoes_admin.motivo IS
  'Justificativa humana obrigatoria para operacoes financeiras administrativas.';

COMMIT;
