BEGIN;

ALTER TABLE webhook_eventos
  DROP CONSTRAINT IF EXISTS webhook_eventos_tentativas_validas;

ALTER TABLE webhook_eventos
  ADD CONSTRAINT webhook_eventos_tentativas_validas
  CHECK (tentativas >= 0);

COMMIT;
