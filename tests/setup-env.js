const path = require("path");
const dotenv = require("dotenv");

jest.mock(
  "../src/repositories/authSessionRepository",
  () => ({
    buscarEstadoDaSessao:
      jest.fn(
        async (usuarioId) => ({
          id: usuarioId,
          ativo: true,
          senha_alterada_em: null,
        })
      ),
  })
);

const resultado = dotenv.config({
  path: path.resolve(
    __dirname,
    "../.env.test"
  ),
  override: true,
  quiet: true
});

if (
  resultado.error &&
  !process.env.DATABASE_URL
) {
  throw new Error(
    "Não foi possível carregar o .env.test."
  );
}

if (
  process.env.NODE_ENV !== "test"
) {
  throw new Error(
    "Jest bloqueado: NODE_ENV não é test."
  );
}

if (
  !process.env.DATABASE_URL
) {
  throw new Error(
    "Jest bloqueado: DATABASE_URL não encontrada."
  );
}

const banco =
  new URL(
    process.env.DATABASE_URL
  );

if (
  banco.hostname ===
  "acela.proxy.rlwy.net"
) {
  throw new Error(
    "Jest bloqueado: banco de produção detectado."
  );
}
