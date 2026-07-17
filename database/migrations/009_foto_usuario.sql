BEGIN;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS
    foto_url TEXT;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS
    foto_public_id VARCHAR(255);

COMMENT ON COLUMN usuarios.foto_url IS
  'URL pública da foto de perfil do usuário.';

COMMENT ON COLUMN usuarios.foto_public_id IS
  'Identificador da imagem no provedor de armazenamento.';

COMMIT;