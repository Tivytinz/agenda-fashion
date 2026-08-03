ALTER TABLE servicos_negocio
ADD COLUMN IF NOT EXISTS categoria VARCHAR(30);

UPDATE servicos_negocio
SET categoria = CASE
  WHEN translate(lower(concat_ws(' ', nome, descricao)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
    ~ '(unha|manicure|pedicure|esmalta|nail|alongamento)' THEN 'unha'
  WHEN translate(lower(concat_ws(' ', nome, descricao)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
    ~ '(cabelo|cabeleire|corte|escova|penteado|progressiva|barba|barbear)' THEN 'cabelo'
  WHEN translate(lower(concat_ws(' ', nome, descricao)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
    ~ '(cilio|lash)' THEN 'cilio'
  WHEN translate(lower(concat_ws(' ', nome, descricao)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
    ~ '(sobrancelha|brow|micropigmenta|design|henna)' THEN 'sobrancelha'
  WHEN translate(lower(concat_ws(' ', nome, descricao)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
    ~ '(maquiagem|makeup|make up)' THEN 'maquiagem'
  WHEN translate(lower(concat_ws(' ', nome, descricao)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
    ~ '(estetica|limpeza de pele|depilacao|massagem|drenagem|facial|corporal)' THEN 'estetica'
  ELSE NULL
END
WHERE categoria IS NULL;

ALTER TABLE servicos_negocio
DROP CONSTRAINT IF EXISTS servicos_negocio_categoria_check;

ALTER TABLE servicos_negocio
ADD CONSTRAINT servicos_negocio_categoria_check
CHECK (
  categoria IS NULL OR categoria IN (
    'unha', 'cabelo', 'cilio', 'sobrancelha', 'maquiagem', 'estetica', 'outro'
  )
);

CREATE INDEX IF NOT EXISTS idx_servicos_negocio_categoria_ativos
ON servicos_negocio (categoria, negocio_id)
WHERE ativo = TRUE;
