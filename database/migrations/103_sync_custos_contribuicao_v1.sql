BEGIN;

INSERT INTO financeiro_marcos (
  chave,
  detalhes
)
VALUES (
  'sync_contribuicao_v1_inicio',
  jsonb_build_object(
    'regra',
      'sync_custos_contribuicao_v1',
    'unidade',
      'negocio',
    'fonte_seed',
      false,
    'adaptador_seed',
      false,
    'credenciais_no_banco',
      false,
    'cobertura_so_apos_reconciliacao',
      true,
    'historico_anterior',
      'nao_inferido',
    'lucro_disponivel',
      false,
    'cac_total_disponivel',
      false
  )
)
ON CONFLICT (chave)
DO NOTHING;

CREATE TABLE contribuicao_integracoes_sync (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  fonte_id BIGINT
    NOT NULL
    REFERENCES contribuicao_fontes(id)
    ON DELETE RESTRICT,

  adaptador VARCHAR(80)
    NOT NULL,

  ativa BOOLEAN
    NOT NULL
    DEFAULT FALSE,

  intervalo_minutos INTEGER
    NOT NULL
    DEFAULT 360,

  cursor JSONB
    NOT NULL
    DEFAULT '{}'::jsonb,

  ultima_sincronizacao_em TIMESTAMPTZ,

  ultimo_sucesso_em TIMESTAMPTZ,

  ultima_falha_em TIMESTAMPTZ,

  ultimo_erro_codigo VARCHAR(80),

  ultimo_erro_detalhe VARCHAR(240),

  created_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  CONSTRAINT contribuicao_integracoes_sync_fonte_uniq
    UNIQUE (fonte_id),

  CONSTRAINT contribuicao_integracoes_sync_adaptador_valido
    CHECK (
      adaptador ~
        '^[a-z0-9][a-z0-9_-]{1,79}$'
    ),

  CONSTRAINT contribuicao_integracoes_sync_intervalo_valido
    CHECK (
      intervalo_minutos
        BETWEEN 15 AND 1440
    )
);

CREATE INDEX
  contribuicao_integracoes_sync_ativas_idx
ON contribuicao_integracoes_sync (
  ativa,
  ultima_sincronizacao_em,
  id
);

CREATE TABLE contribuicao_sincronizacoes (
  id BIGINT
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  integracao_id BIGINT
    NOT NULL
    REFERENCES contribuicao_integracoes_sync(id)
    ON DELETE RESTRICT,

  status VARCHAR(20)
    NOT NULL,

  cursor_entrada JSONB
    NOT NULL
    DEFAULT '{}'::jsonb,

  cursor_saida JSONB,

  itens_recebidos INTEGER
    NOT NULL
    DEFAULT 0,

  itens_importados INTEGER
    NOT NULL
    DEFAULT 0,

  itens_replay INTEGER
    NOT NULL
    DEFAULT 0,

  cobertura_inicio DATE,

  cobertura_ate DATE,

  cobertura_status VARCHAR(20),

  erro_codigo VARCHAR(80),

  erro_detalhe VARCHAR(240),

  iniciado_em TIMESTAMPTZ
    NOT NULL
    DEFAULT NOW(),

  finalizado_em TIMESTAMPTZ,

  CONSTRAINT contribuicao_sincronizacoes_status_valido
    CHECK (
      status IN (
        'EXECUTANDO',
        'SUCESSO',
        'ERRO'
      )
    ),

  CONSTRAINT contribuicao_sincronizacoes_contadores_validos
    CHECK (
      itens_recebidos >= 0
      AND itens_importados >= 0
      AND itens_replay >= 0
    ),

  CONSTRAINT contribuicao_sincronizacoes_cobertura_status_valido
    CHECK (
      cobertura_status IS NULL
      OR cobertura_status IN (
        'COMPLETA',
        'INCOMPLETA'
      )
    )
);

CREATE INDEX
  contribuicao_sincronizacoes_integracao_data_idx
ON contribuicao_sincronizacoes (
  integracao_id,
  iniciado_em DESC,
  id DESC
);

COMMENT ON TABLE contribuicao_integracoes_sync IS
  'Configura fontes factuais para adaptadores internos de sincronizacao. Nao armazena segredos nem cria fonte automaticamente.';

COMMENT ON COLUMN contribuicao_integracoes_sync.cursor IS
  'Cursor opaco devolvido pelo adaptador. So avanca na mesma transacao que persiste fatos e cobertura reconciliada.';

COMMENT ON TABLE contribuicao_sincronizacoes IS
  'Historico operacional das tentativas de ingestao automatica de custos variaveis de contribuicao.';

COMMIT;
