UPDATE servicos_negocio
SET nome = REGEXP_REPLACE(
  nome,
  '^[[:space:]•·▪◦]+',
  ''
)
WHERE nome ~ '^[[:space:]•·▪◦]+'
  AND CHAR_LENGTH(
    REGEXP_REPLACE(
      nome,
      '^[[:space:]•·▪◦]+',
      ''
    )
  ) BETWEEN 2 AND 120;
