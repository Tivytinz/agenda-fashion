BEGIN;

DO $$
DECLARE
  campanha_ativa_id BIGINT;
  campanha_legada_id BIGINT;
  vinculo_legado marketing_campanha_vinculos%ROWTYPE;
  vinculo_ativo marketing_campanha_vinculos%ROWTYPE;
BEGIN
  SELECT id
  INTO campanha_ativa_id
  FROM marketing_campanhas
  WHERE utm_source = 'google'
    AND utm_medium = 'cpc'
    AND utm_campaign = 'google_ads_profissionais'
    AND objetivo = 'profissional'
    AND ativo = TRUE
  LIMIT 1;

  SELECT id
  INTO campanha_legada_id
  FROM marketing_campanhas
  WHERE utm_source = 'google'
    AND utm_medium = 'cpc'
    AND utm_campaign = 'profissionais_google_ads'
    AND objetivo = 'indefinido'
    AND ativo = FALSE
  LIMIT 1;

  -- Bancos novos e ambientes sem essas campanhas não precisam de correção.
  IF campanha_ativa_id IS NULL OR campanha_legada_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO vinculo_legado
  FROM marketing_campanha_vinculos
  WHERE campanha_id = campanha_legada_id
    AND provedor = 'google_ads'
  LIMIT 1;

  SELECT *
  INTO vinculo_ativo
  FROM marketing_campanha_vinculos
  WHERE campanha_id = campanha_ativa_id
    AND provedor = 'google_ads'
  LIMIT 1;

  IF vinculo_legado.id IS NOT NULL THEN
    IF vinculo_ativo.id IS NULL THEN
      UPDATE marketing_campanha_vinculos
      SET
        campanha_id = campanha_ativa_id,
        updated_at = NOW()
      WHERE id = vinculo_legado.id;
    ELSIF
      vinculo_ativo.conta_externa_id = vinculo_legado.conta_externa_id
      AND vinculo_ativo.campanha_externa_id = vinculo_legado.campanha_externa_id
    THEN
      DELETE FROM marketing_campanha_vinculos
      WHERE id = vinculo_legado.id;
    ELSE
      RAISE EXCEPTION
        'A campanha ativa já possui outro vínculo Google Ads; correção automática interrompida.';
    END IF;
  END IF;

  INSERT INTO marketing_campanha_gastos (
    campanha_id,
    data_gasto,
    valor_centavos,
    moeda,
    fonte,
    observacao,
    criado_por_usuario_id,
    atualizado_por_usuario_id,
    created_at,
    updated_at
  )
  SELECT
    campanha_ativa_id,
    data_gasto,
    valor_centavos,
    moeda,
    fonte,
    observacao,
    criado_por_usuario_id,
    atualizado_por_usuario_id,
    created_at,
    NOW()
  FROM marketing_campanha_gastos
  WHERE campanha_id = campanha_legada_id
  ON CONFLICT (campanha_id, data_gasto, fonte)
  DO UPDATE SET
    valor_centavos = EXCLUDED.valor_centavos,
    moeda = EXCLUDED.moeda,
    observacao = EXCLUDED.observacao,
    atualizado_por_usuario_id = EXCLUDED.atualizado_por_usuario_id,
    updated_at = NOW();

  DELETE FROM marketing_campanha_gastos
  WHERE campanha_id = campanha_legada_id;

  UPDATE marketing_campanhas
  SET updated_at = NOW()
  WHERE id = campanha_ativa_id;
END;
$$;

COMMIT;
