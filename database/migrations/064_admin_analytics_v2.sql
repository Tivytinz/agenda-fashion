BEGIN;

-- =========================================================
-- ONBOARDING: publicação não depende mais de confirmação da agenda.
-- A disponibilidade nasce com a sugestão do AF e pode ser personalizada depois.
-- =========================================================

ALTER TABLE negocios
  ALTER COLUMN publicacao_exige_agenda SET DEFAULT FALSE;

UPDATE negocios
SET publicacao_exige_agenda = FALSE
WHERE publicacao_exige_agenda = TRUE;

COMMENT ON COLUMN negocios.publicacao_exige_agenda IS
  'Campo legado. A publicação atual depende dos dados obrigatórios do negócio e de pelo menos um serviço ativo; horários são sugeridos pelo AF e editáveis depois.';

ALTER TABLE agenda_configuracoes
  ADD COLUMN IF NOT EXISTS origem_horarios VARCHAR(24),
  ADD COLUMN IF NOT EXISTS primeira_personalizacao_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultima_personalizacao_em TIMESTAMPTZ;

UPDATE agenda_configuracoes
SET origem_horarios = CASE
  WHEN configurado_em IS NULL THEN 'padrao_af'
  ELSE 'legado_desconhecido'
END
WHERE origem_horarios IS NULL;

ALTER TABLE agenda_configuracoes
  ALTER COLUMN origem_horarios SET DEFAULT 'padrao_af',
  ALTER COLUMN origem_horarios SET NOT NULL;

ALTER TABLE agenda_configuracoes
  DROP CONSTRAINT IF EXISTS agenda_configuracoes_origem_horarios_check;

ALTER TABLE agenda_configuracoes
  ADD CONSTRAINT agenda_configuracoes_origem_horarios_check
  CHECK (origem_horarios IN ('padrao_af', 'personalizado', 'legado_desconhecido'));

COMMENT ON COLUMN agenda_configuracoes.origem_horarios IS
  'Indica se a disponibilidade usa a sugestão automática do AF, foi personalizada ou é legado sem origem comprovável.';

-- Configurações ainda não confirmadas eram defaults históricos. Normaliza somente
-- essas configurações para a sugestão atual do AF antes de liberar disponibilidade.
INSERT INTO agenda_horarios (
  profissional_id,
  dia_semana,
  trabalha,
  hora_inicio,
  hora_fim,
  intervalo_inicio,
  intervalo_fim
)
SELECT
  ac.profissional_id,
  d.dia_semana,
  d.trabalha,
  d.hora_inicio,
  d.hora_fim,
  d.intervalo_inicio,
  d.intervalo_fim
FROM agenda_configuracoes ac
CROSS JOIN (
  VALUES
    (0::SMALLINT, FALSE, NULL::TIME, NULL::TIME, NULL::TIME, NULL::TIME),
    (1::SMALLINT, TRUE,  TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
    (2::SMALLINT, TRUE,  TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
    (3::SMALLINT, TRUE,  TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
    (4::SMALLINT, TRUE,  TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
    (5::SMALLINT, TRUE,  TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
    (6::SMALLINT, TRUE,  TIME '08:00', TIME '13:00', NULL::TIME, NULL::TIME)
) AS d(dia_semana, trabalha, hora_inicio, hora_fim, intervalo_inicio, intervalo_fim)
WHERE ac.configurado_em IS NULL
ON CONFLICT (profissional_id, dia_semana)
DO UPDATE SET
  trabalha = EXCLUDED.trabalha,
  hora_inicio = EXCLUDED.hora_inicio,
  hora_fim = EXCLUDED.hora_fim,
  intervalo_inicio = EXCLUDED.intervalo_inicio,
  intervalo_fim = EXCLUDED.intervalo_fim;

-- Publica negócios que já estavam prontos e só aguardavam o gate removido.
UPDATE negocios n
SET
  publicado = TRUE,
  primeira_publicacao_em = COALESCE(n.primeira_publicacao_em, NOW())
WHERE n.ativo = TRUE
  AND n.publicado = FALSE
  AND NULLIF(BTRIM(n.nome), '') IS NOT NULL
  AND NULLIF(BTRIM(n.whatsapp), '') IS NOT NULL
  AND NULLIF(BTRIM(n.cidade), '') IS NOT NULL
  AND NULLIF(BTRIM(n.estado), '') IS NOT NULL
  AND NULLIF(BTRIM(n.bairro), '') IS NOT NULL
  AND NULLIF(BTRIM(n.endereco), '') IS NOT NULL
  AND NULLIF(BTRIM(n.numero), '') IS NOT NULL
  AND NULLIF(BTRIM(n.cep), '') IS NOT NULL
  AND NULLIF(BTRIM(n.localizacao_url), '') IS NOT NULL
  AND (
    COALESCE(CARDINALITY(n.areas), 0) > 0
    OR NULLIF(BTRIM(COALESCE(n.setor, '')), '') IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM servicos_negocio sn
    WHERE sn.negocio_id = n.id
      AND sn.ativo = TRUE
  );

-- =========================================================
-- ANALYTICS FIRST-PARTY
-- =========================================================

CREATE TABLE analytics_visitantes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_uuid UUID NOT NULL UNIQUE,
  primeiro_visto_em TIMESTAMPTZ NOT NULL,
  ultimo_visto_em TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_visitantes_datas_check
    CHECK (ultimo_visto_em >= primeiro_visto_em)
);

CREATE INDEX analytics_visitantes_ultimo_visto_idx
  ON analytics_visitantes (ultimo_visto_em DESC);

CREATE TRIGGER analytics_visitantes_updated_at_trigger
BEFORE UPDATE ON analytics_visitantes
FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();

CREATE TABLE analytics_identidade_vinculos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitante_id BIGINT NOT NULL REFERENCES analytics_visitantes(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  vinculo_tipo VARCHAR(24) NOT NULL,
  primeiro_vinculo_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_confirmacao_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_identidade_tipo_check
    CHECK (vinculo_tipo IN ('cadastro', 'login_autenticado')),
  CONSTRAINT analytics_identidade_visitante_usuario_unique
    UNIQUE (visitante_id, usuario_id)
);

CREATE INDEX analytics_identidade_usuario_idx
  ON analytics_identidade_vinculos (usuario_id, ultima_confirmacao_em DESC);

CREATE TABLE analytics_sessoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_uuid UUID NOT NULL UNIQUE,
  visitante_id BIGINT NOT NULL REFERENCES analytics_visitantes(id) ON DELETE CASCADE,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  identificado_em TIMESTAMPTZ,
  iniciada_em TIMESTAMPTZ NOT NULL,
  ultima_atividade_em TIMESTAMPTZ NOT NULL,
  encerrada_em TIMESTAMPTZ,
  tempo_engajado_ms BIGINT NOT NULL DEFAULT 0,
  visualizacoes INTEGER NOT NULL DEFAULT 0,
  eventos INTEGER NOT NULL DEFAULT 0,
  tela_entrada VARCHAR(80),
  tela_saida VARCHAR(80),
  device_type VARCHAR(20),
  browser_family VARCHAR(40),
  browser_major VARCHAR(12),
  os_family VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_sessoes_tempo_check CHECK (tempo_engajado_ms >= 0),
  CONSTRAINT analytics_sessoes_contadores_check CHECK (visualizacoes >= 0 AND eventos >= 0),
  CONSTRAINT analytics_sessoes_datas_check CHECK (
    ultima_atividade_em >= iniciada_em
    AND (encerrada_em IS NULL OR encerrada_em >= iniciada_em)
  )
);

CREATE INDEX analytics_sessoes_visitante_idx
  ON analytics_sessoes (visitante_id, iniciada_em DESC);
CREATE INDEX analytics_sessoes_usuario_idx
  ON analytics_sessoes (usuario_id, iniciada_em DESC)
  WHERE usuario_id IS NOT NULL;
CREATE INDEX analytics_sessoes_inicio_idx
  ON analytics_sessoes (iniciada_em DESC);

CREATE TRIGGER analytics_sessoes_updated_at_trigger
BEFORE UPDATE ON analytics_sessoes
FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();

CREATE TABLE analytics_sessao_origens (
  sessao_id BIGINT PRIMARY KEY REFERENCES analytics_sessoes(id) ON DELETE CASCADE,
  canal VARCHAR(32) NOT NULL DEFAULT 'unknown',
  source VARCHAR(80),
  medium VARCHAR(80),
  referrer_host VARCHAR(200),
  landing_page_key VARCHAR(80),
  campanha_oficial_id BIGINT REFERENCES marketing_campanhas(id) ON DELETE SET NULL,
  classificacao VARCHAR(32) NOT NULL DEFAULT 'sem_evidencia',
  metodo_resolucao VARCHAR(32),
  capturado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_sessao_origens_canal_check CHECK (
    canal IN ('paid_search','paid_social','organic_search','ai_assistant','direct','referral','email','organic_social','other','unknown')
  )
);

CREATE INDEX analytics_sessao_origens_canal_idx
  ON analytics_sessao_origens (canal, capturado_em DESC);
CREATE INDEX analytics_sessao_origens_campanha_idx
  ON analytics_sessao_origens (campanha_oficial_id, capturado_em DESC)
  WHERE campanha_oficial_id IS NOT NULL;

CREATE TABLE marketing_sessao_evidencias (
  sessao_id BIGINT PRIMARY KEY REFERENCES analytics_sessoes(id) ON DELETE CASCADE,
  utm_source VARCHAR(80),
  utm_medium VARCHAR(80),
  utm_campaign VARCHAR(140),
  utm_content VARCHAR(140),
  utm_term VARCHAR(140),
  gclid VARCHAR(200),
  gbraid VARCHAR(200),
  wbraid VARCHAR(200),
  fbclid VARCHAR(200),
  msclkid VARCHAR(200),
  ttclid VARCHAR(200),
  landing_page VARCHAR(500),
  referrer_host VARCHAR(200),
  capturado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE analytics_visualizacoes_tela (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  view_uuid UUID NOT NULL UNIQUE,
  sessao_id BIGINT NOT NULL REFERENCES analytics_sessoes(id) ON DELETE CASCADE,
  sequencia INTEGER NOT NULL,
  page_key VARCHAR(80) NOT NULL,
  route_template VARCHAR(160) NOT NULL,
  target_business_id BIGINT REFERENCES negocios(id) ON DELETE SET NULL,
  target_service_id BIGINT REFERENCES servicos_negocio(id) ON DELETE SET NULL,
  entrou_em TIMESTAMPTZ NOT NULL,
  ultima_atividade_em TIMESTAMPTZ NOT NULL,
  saiu_em TIMESTAMPTZ,
  tempo_engajado_ms BIGINT NOT NULL DEFAULT 0,
  motivo_saida VARCHAR(24),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_visualizacoes_sequencia_check CHECK (sequencia > 0),
  CONSTRAINT analytics_visualizacoes_tempo_check CHECK (tempo_engajado_ms >= 0),
  CONSTRAINT analytics_visualizacoes_datas_check CHECK (
    ultima_atividade_em >= entrou_em
    AND (saiu_em IS NULL OR saiu_em >= entrou_em)
  ),
  CONSTRAINT analytics_visualizacoes_sessao_sequencia_unique UNIQUE (sessao_id, sequencia)
);

CREATE INDEX analytics_visualizacoes_sessao_idx
  ON analytics_visualizacoes_tela (sessao_id, entrou_em);
CREATE INDEX analytics_visualizacoes_page_idx
  ON analytics_visualizacoes_tela (page_key, entrou_em DESC);
CREATE INDEX analytics_visualizacoes_negocio_idx
  ON analytics_visualizacoes_tela (target_business_id, entrou_em DESC)
  WHERE target_business_id IS NOT NULL;

CREATE TABLE analytics_eventos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_uuid UUID NOT NULL UNIQUE,
  sessao_id BIGINT REFERENCES analytics_sessoes(id) ON DELETE SET NULL,
  visualizacao_id BIGINT REFERENCES analytics_visualizacoes_tela(id) ON DELETE SET NULL,
  nome VARCHAR(80) NOT NULL,
  schema_version SMALLINT NOT NULL DEFAULT 1,
  origem VARCHAR(16) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  actor_business_id BIGINT REFERENCES negocios(id) ON DELETE SET NULL,
  target_business_id BIGINT REFERENCES negocios(id) ON DELETE SET NULL,
  target_service_id BIGINT REFERENCES servicos_negocio(id) ON DELETE SET NULL,
  agendamento_id BIGINT REFERENCES agendamentos(id) ON DELETE SET NULL,
  flow_uuid UUID,
  propriedades JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT analytics_eventos_schema_check CHECK (schema_version > 0),
  CONSTRAINT analytics_eventos_origem_check CHECK (origem IN ('frontend','backend','webhook','system')),
  CONSTRAINT analytics_eventos_propriedades_objeto_check CHECK (jsonb_typeof(propriedades) = 'object')
);

CREATE INDEX analytics_eventos_nome_data_idx
  ON analytics_eventos (nome, occurred_at DESC);
CREATE INDEX analytics_eventos_sessao_idx
  ON analytics_eventos (sessao_id, occurred_at)
  WHERE sessao_id IS NOT NULL;
CREATE INDEX analytics_eventos_actor_idx
  ON analytics_eventos (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;
CREATE INDEX analytics_eventos_target_negocio_idx
  ON analytics_eventos (target_business_id, occurred_at DESC)
  WHERE target_business_id IS NOT NULL;

CREATE TABLE assinatura_status_historico (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assinatura_id BIGINT NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
  negocio_id BIGINT NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  plano_id BIGINT REFERENCES planos(id) ON DELETE SET NULL,
  evento_tipo VARCHAR(32) NOT NULL,
  status_anterior VARCHAR(40),
  status_novo VARCHAR(40),
  ativo_anterior BOOLEAN,
  ativo_novo BOOLEAN,
  valor NUMERIC(10,2),
  origem VARCHAR(24) NOT NULL,
  webhook_evento_id BIGINT REFERENCES webhook_eventos(id) ON DELETE SET NULL,
  correlation_uuid UUID,
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assinatura_status_historico_evento_check CHECK (
    evento_tipo IN ('ativada','renovada','cancelada','reativada','upgrade','downgrade','expirada','status_alterado')
  ),
  CONSTRAINT assinatura_status_historico_origem_check CHECK (
    origem IN ('backend','webhook','system','admin')
  )
);

CREATE INDEX assinatura_status_historico_assinatura_idx
  ON assinatura_status_historico (assinatura_id, ocorrido_em DESC);
CREATE INDEX assinatura_status_historico_negocio_idx
  ON assinatura_status_historico (negocio_id, ocorrido_em DESC);

COMMIT;
