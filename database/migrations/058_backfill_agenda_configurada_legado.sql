BEGIN;

-- `configurado_em` passou a existir depois das primeiras versões da agenda.
-- Recupera apenas configurações legadas com evidência de edição persistida.
-- Defaults criados e nunca alterados permanecem com `configurado_em` nulo.
WITH horarios_editados AS (
  SELECT
    profissional_id,
    MIN(updated_at) AS primeira_edicao_em
  FROM agenda_horarios
  WHERE updated_at > created_at
  GROUP BY profissional_id
),
candidatos AS (
  SELECT
    ac.id,
    CASE
      WHEN
        ac.updated_at > ac.created_at
        AND he.primeira_edicao_em IS NOT NULL
      THEN LEAST(
        ac.updated_at,
        he.primeira_edicao_em
      )
      WHEN ac.updated_at > ac.created_at
        THEN ac.updated_at
      ELSE he.primeira_edicao_em
    END AS configurado_em_recuperado
  FROM agenda_configuracoes ac
  LEFT JOIN horarios_editados he
    ON he.profissional_id =
      ac.profissional_id
  WHERE ac.configurado_em IS NULL
)
UPDATE agenda_configuracoes ac
SET configurado_em =
  candidatos.configurado_em_recuperado
FROM candidatos
WHERE candidatos.id = ac.id
  AND candidatos.configurado_em_recuperado
    IS NOT NULL;

COMMIT;
