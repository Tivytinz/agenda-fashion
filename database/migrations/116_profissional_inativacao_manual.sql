BEGIN;

ALTER TABLE usuarios_negocios
  DROP CONSTRAINT IF EXISTS usuarios_negocios_motivo_inatividade_valido;

ALTER TABLE usuarios_negocios
  ADD CONSTRAINT usuarios_negocios_motivo_inatividade_valido
  CHECK (
    motivo_inatividade IS NULL
    OR (
      ativo = FALSE
      AND papel = 'profissional'
      AND motivo_inatividade IN (
        'aguardando_vaga_plano',
        'excedente_limite_plano',
        'inativado_pela_dona'
      )
    )
  );

COMMENT ON COLUMN usuarios_negocios.motivo_inatividade IS
'Vínculo profissional preservado e inativo: aguardando_vaga_plano, excedente_limite_plano ou inativado_pela_dona. A inativação manual não altera reservas nem a criação do vínculo.';

COMMIT;
