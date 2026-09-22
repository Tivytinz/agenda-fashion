BEGIN;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS
    perfil_profissional_ativado_em TIMESTAMPTZ;

UPDATE usuarios u
SET perfil_profissional_ativado_em =
  COALESCE(
    u.perfil_profissional_ativado_em,
    vinculos.primeiro_vinculo_em
  )
FROM (
  SELECT
    usuario_id,
    MIN(created_at) AS primeiro_vinculo_em
  FROM usuarios_negocios
  WHERE papel IN ('dono', 'profissional')
  GROUP BY usuario_id
) vinculos
WHERE vinculos.usuario_id = u.id
  AND u.perfil_profissional_ativado_em IS NULL;

COMMENT ON COLUMN usuarios.perfil_profissional_ativado_em IS
  'Marca durável de que a identidade única da conta possui perfil profissional ativo, independentemente do vínculo atual com um negócio.';

COMMIT;
