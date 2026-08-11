BEGIN;

CREATE TABLE marketing_campanha_vinculos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campanha_id BIGINT NOT NULL
    REFERENCES marketing_campanhas(id)
    ON DELETE CASCADE,
  provedor VARCHAR(32) NOT NULL,
  conta_externa_id VARCHAR(120) NOT NULL,
  campanha_externa_id VARCHAR(120) NOT NULL,
  campanha_externa_nome VARCHAR(240),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT marketing_campanha_vinculos_provedor_valido
    CHECK (provedor IN ('google_ads', 'meta_ads')),
  CONSTRAINT marketing_campanha_vinculos_campanha_provedor_unique
    UNIQUE (campanha_id, provedor),
  CONSTRAINT marketing_campanha_vinculos_externo_unique
    UNIQUE (provedor, conta_externa_id, campanha_externa_id)
);

CREATE INDEX marketing_campanha_vinculos_campanha_idx
  ON marketing_campanha_vinculos (campanha_id);

CREATE TABLE marketing_custo_sincronizacoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provedor VARCHAR(32) NOT NULL,
  status VARCHAR(24) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  registros_importados INTEGER NOT NULL DEFAULT 0,
  campanhas_nao_vinculadas INTEGER NOT NULL DEFAULT 0,
  erro_codigo VARCHAR(80),
  erro_mensagem VARCHAR(300),
  iniciado_por_usuario_id BIGINT
    REFERENCES usuarios(id)
    ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,

  CONSTRAINT marketing_custo_sincronizacoes_provedor_valido
    CHECK (provedor IN ('google_ads', 'meta_ads')),
  CONSTRAINT marketing_custo_sincronizacoes_status_valido
    CHECK (status IN ('executando', 'sucesso', 'parcial', 'erro')),
  CONSTRAINT marketing_custo_sincronizacoes_periodo_valido
    CHECK (data_inicio <= data_fim),
  CONSTRAINT marketing_custo_sincronizacoes_registros_validos
    CHECK (
      registros_importados >= 0
      AND campanhas_nao_vinculadas >= 0
    )
);

CREATE INDEX marketing_custo_sincronizacoes_provedor_data_idx
  ON marketing_custo_sincronizacoes (
    provedor,
    created_at DESC
  );

COMMENT ON TABLE marketing_campanha_vinculos IS
  'Liga uma campanha rastreável do Agenda Fashion à campanha equivalente em uma plataforma de anúncios.';

COMMENT ON TABLE marketing_custo_sincronizacoes IS
  'Auditoria das importações de custo das plataformas de mídia, sem armazenar tokens ou segredos.';

COMMENT ON COLUMN marketing_campanha_gastos.fonte IS
  'Origem do custo: manual, google_ads ou meta_ads. Quando existir custo automático para o mesmo dia, ele prevalece no relatório sobre o lançamento manual.';

COMMIT;
