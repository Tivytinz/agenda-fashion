BEGIN;

-- `configurado_em` deixa de representar uma confirmação manual do onboarding.
-- A partir deste fluxo, ele é somente um marcador técnico de que a
-- disponibilidade já foi inicializada e pode alimentar a agenda pública.

ALTER TABLE agenda_configuracoes
  ALTER COLUMN configurado_em SET DEFAULT NOW();

COMMENT ON COLUMN agenda_configuracoes.configurado_em IS
  'Marcador técnico legado de disponibilidade inicializada. Não representa confirmação manual e não deve ser usado como etapa de ativação.';

-- Garante configuração para todos os donos/profissionais ativos que já possuem
-- vínculo com negócio ativo. Novos vínculos recebem o mesmo estado pelo código.
INSERT INTO agenda_configuracoes (
  profissional_id,
  duracao_padrao,
  intervalo_minutos,
  antecedencia_agendamento,
  antecedencia_cancelamento,
  configurado_em,
  origem_horarios
)
SELECT DISTINCT
  un.usuario_id,
  60,
  0,
  0,
  24,
  NOW(),
  'padrao_af'
FROM usuarios_negocios un
INNER JOIN usuarios u
  ON u.id = un.usuario_id
INNER JOIN negocios n
  ON n.id = un.negocio_id
WHERE un.ativo = TRUE
  AND u.ativo = TRUE
  AND n.ativo = TRUE
  AND un.papel IN ('dono', 'profissional')
ON CONFLICT (profissional_id)
DO NOTHING;

-- A migration 064 classificou configurações nunca confirmadas como `padrao_af`.
-- Essas são as únicas que podem ser normalizadas automaticamente sem
-- sobrescrever disponibilidade comprovadamente personalizada.
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
WHERE ac.origem_horarios = 'padrao_af'
ON CONFLICT (profissional_id, dia_semana)
DO UPDATE SET
  trabalha = EXCLUDED.trabalha,
  hora_inicio = EXCLUDED.hora_inicio,
  hora_fim = EXCLUDED.hora_fim,
  intervalo_inicio = EXCLUDED.intervalo_inicio,
  intervalo_fim = EXCLUDED.intervalo_fim;

UPDATE agenda_configuracoes
SET configurado_em = COALESCE(configurado_em, NOW())
WHERE configurado_em IS NULL;

COMMIT;
