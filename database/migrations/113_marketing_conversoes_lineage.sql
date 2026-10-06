BEGIN;

ALTER TABLE marketing_conversoes_entregas
  ADD COLUMN assinatura_evento_id BIGINT,
  ADD COLUMN resultado_codigo VARCHAR(80),
  ADD COLUMN ocorrido_em TIMESTAMPTZ;

ALTER TABLE marketing_conversoes_entregas
  ADD CONSTRAINT marketing_conversoes_assinatura_evento_fk
  FOREIGN KEY (assinatura_evento_id)
  REFERENCES assinatura_eventos(id)
  ON DELETE SET NULL;

WITH candidatos AS (
  SELECT
    entrega.id AS entrega_id,
    evento.id AS assinatura_evento_id,
    pagamento.data_pagamento,
    ROW_NUMBER() OVER (
      PARTITION BY
        entrega.provedor,
        evento.id
      ORDER BY
        CASE entrega.status
          WHEN 'SENT' THEN 0
          WHEN 'PROCESSING' THEN 1
          WHEN 'PENDING' THEN 2
          WHEN 'FAILED' THEN 3
          WHEN 'IGNORED' THEN 4
          ELSE 5
        END,
        entrega.id ASC
    ) AS ordem
  FROM marketing_conversoes_entregas entrega
  INNER JOIN pagamentos pagamento
    ON pagamento.asaas_payment_id =
      entrega.payload ->> 'pagamentoId'
  INNER JOIN assinatura_eventos evento
    ON evento.pagamento_id = pagamento.id
   AND evento.assinatura_id = pagamento.assinatura_id
   AND evento.tipo = 'CONVERSAO_INICIAL'
  WHERE entrega.tipo_evento = 'SUBSCRIPTION_ACTIVATED'
    AND entrega.assinatura_evento_id IS NULL
)
UPDATE marketing_conversoes_entregas entrega
SET
  assinatura_evento_id =
    candidatos.assinatura_evento_id,
  ocorrido_em =
    COALESCE(
      entrega.ocorrido_em,
      candidatos.data_pagamento
    ),
  resultado_codigo =
    CASE
      WHEN entrega.status = 'SENT'
        THEN 'ENVIADO'
      WHEN entrega.status = 'IGNORED'
        AND entrega.ultimo_erro = 'sem_consentimento'
        THEN 'SEM_CONSENTIMENTO'
      WHEN entrega.status = 'IGNORED'
        AND entrega.ultimo_erro = 'desabilitado'
        THEN 'INTEGRACAO_DESABILITADA'
      WHEN entrega.status = 'IGNORED'
        AND entrega.ultimo_erro = 'renovacao'
        THEN 'DIVERGENCIA_FINANCEIRA'
      ELSE entrega.resultado_codigo
    END
FROM candidatos
WHERE entrega.id = candidatos.entrega_id
  AND candidatos.ordem = 1;

CREATE OR REPLACE FUNCTION
  proteger_lineage_marketing_conversao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  IF OLD.assinatura_evento_id IS NOT NULL
    AND (
      NEW.assinatura_evento_id IS DISTINCT FROM
        OLD.assinatura_evento_id
      OR NEW.provedor IS DISTINCT FROM OLD.provedor
      OR NEW.tipo_evento IS DISTINCT FROM OLD.tipo_evento
      OR NEW.chave_evento IS DISTINCT FROM OLD.chave_evento
      OR NEW.payload IS DISTINCT FROM OLD.payload
      OR NEW.ocorrido_em IS DISTINCT FROM OLD.ocorrido_em
    )
  THEN
    RAISE EXCEPTION
      'Lineage financeiro da conversão de marketing é imutável.';
  END IF;

  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS
  marketing_conversoes_lineage_imutavel
ON marketing_conversoes_entregas;

CREATE TRIGGER
  marketing_conversoes_lineage_imutavel
BEFORE UPDATE OF
  assinatura_evento_id,
  provedor,
  tipo_evento,
  chave_evento,
  payload,
  ocorrido_em
ON marketing_conversoes_entregas
FOR EACH ROW
EXECUTE FUNCTION
  proteger_lineage_marketing_conversao();

CREATE UNIQUE INDEX
  marketing_conversoes_provedor_evento_financeiro_unique
ON marketing_conversoes_entregas (
  provedor,
  assinatura_evento_id
)
WHERE assinatura_evento_id IS NOT NULL;

CREATE INDEX
  marketing_conversoes_assinatura_evento_idx
ON marketing_conversoes_entregas (
  assinatura_evento_id
)
WHERE assinatura_evento_id IS NOT NULL;

COMMENT ON COLUMN
  marketing_conversoes_entregas.assinatura_evento_id
IS
  'Lineage do fato financeiro canônico que originou a entrega. Para aquisição paga nova, deve apontar para assinatura_eventos.tipo=CONVERSAO_INICIAL.';

COMMENT ON COLUMN
  marketing_conversoes_entregas.resultado_codigo
IS
  'Código estruturado do resultado operacional. Não usar ultimo_erro como contrato analítico.';

COMMENT ON COLUMN
  marketing_conversoes_entregas.ocorrido_em
IS
  'Timestamp canônico do pagamento que originou a conversão, separado de created_at/enviado_em da fila.';

COMMIT;
