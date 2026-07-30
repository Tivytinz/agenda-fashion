process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "teste-sessao-jwt-secret-com-mais-de-32-caracteres";

const express = require(
  "express"
);

const jwt = require(
  "jsonwebtoken"
);

const request = require(
  "supertest"
);

const authSessionRepository =
  require(
    "../src/repositories/authSessionRepository"
  );

const auth = require(
  "../src/middlewares/auth"
);

function criarApp() {
  const app =
    express();

  app.get(
    "/protegida",
    auth,
    (req, res) =>
      res.json({
        usuarioId:
          req.user.id,
      })
  );

  app.use(
    (
      erro,
      _req,
      res,
      _next
    ) =>
      res.status(500).json({
        erro:
          erro.message,
      })
  );

  return app;
}

function gerarToken({
  usuarioId = 1,
  emitidoEm,
} = {}) {
  return jwt.sign(
    {
      id:
        usuarioId,
      ...(emitidoEm
        ? {
            iat:
              emitidoEm,
          }
        : {}),
    },
    process.env.JWT_SECRET,
    {
      expiresIn:
        "1h",
    }
  );
}

describe(
  "Validação central da sessão",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      authSessionRepository
        .buscarEstadoDaSessao
        .mockResolvedValue({
          id: 1,
          ativo: true,
          senha_alterada_em:
            null,
        });
    });

    test(
      "aceita conta ativa",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .get("/protegida")
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            );

        expect(
          resposta.status
        ).toBe(200);
      }
    );

    test(
      "recusa conta desativada",
      async () => {
        authSessionRepository
          .buscarEstadoDaSessao
          .mockResolvedValue({
            id: 1,
            ativo: false,
            senha_alterada_em:
              null,
          });

        const resposta =
          await request(
            criarApp()
          )
            .get("/protegida")
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            );

        expect(
          resposta.status
        ).toBe(401);
      }
    );

    test(
      "invalida token emitido antes da troca de senha",
      async () => {
        const emitidoEm =
          Math.floor(
            Date.now() / 1000
          ) - 120;

        authSessionRepository
          .buscarEstadoDaSessao
          .mockResolvedValue({
            id: 1,
            ativo: true,
            senha_alterada_em:
              new Date(
                (
                  emitidoEm +
                  60
                ) * 1000
              ).toISOString(),
          });

        const resposta =
          await request(
            criarApp()
          )
            .get("/protegida")
            .set(
              "Authorization",
              `Bearer ${gerarToken({
                emitidoEm,
              })}`
            );

        expect(
          resposta.status
        ).toBe(401);
      }
    );

    test(
      "propaga falha do banco para o tratador de erros",
      async () => {
        authSessionRepository
          .buscarEstadoDaSessao
          .mockRejectedValue(
            new Error(
              "Banco indisponível"
            )
          );

        const resposta =
          await request(
            criarApp()
          )
            .get("/protegida")
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            );

        expect(
          resposta.status
        ).toBe(500);
      }
    );
  }
);
