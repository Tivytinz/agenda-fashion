BEGIN;

ALTER TABLE marketing_campanhas
  ADD COLUMN objetivo VARCHAR(24)
    NOT NULL
    DEFAULT 'indefinido';

ALTER TABLE marketing_campanhas
  ADD CONSTRAINT marketing_campanhas_objetivo_valido
    CHECK (
      objetivo IN (
        'indefinido',
        'profissional',
        'cliente'
      )
    );

CREATE INDEX marketing_campanhas_objetivo_ativas_idx
  ON marketing_campanhas (
    objetivo,
    ativo,
    created_at DESC
  );

COMMENT ON COLUMN marketing_campanhas.objetivo IS
  'Intenção operacional da campanha. Registros legados ficam indefinidos até classificação explícita; novas campanhas devem informar profissional ou cliente.';

COMMIT;
