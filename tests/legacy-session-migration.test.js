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
const authController = require(
  "../src/controllers/authController"
);

function criarApp() {
  const app =
    express();

  app.post(
    "/auth/migrar-sessao-legada",
    auth,
    authController
      .migrarSessaoLegada
  );

  app.use(
    (
      erro,
      _req,
      res,
      _next
    ) =>
      res.status(
        erro.statusCode ||
          500
      ).json({
        erro:
          erro.message,
      })
  );

  return app;
}

function tokenValido() {
  return jwt.sign(
    {
      id: 1,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );
}

describe(
  "migração da sessão Bearer legada",
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
          token_revogado:
            false,
        });
    });

    test(
      "converte Bearer válido em cookie HttpOnly sem devolver o token",
      async () => {
        const token =
          tokenValido();

        const resposta =
          await request(
            criarApp()
          )
            .post(
              "/auth/migrar-sessao-legada"
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          resposta.status
        ).toBe(204);

        expect(
          resposta.text
        ).toBe("");

        expect(
          resposta.headers[
            "cache-control"
          ]
        ).toContain(
          "no-store"
        );

        expect(
          resposta.headers[
            "set-cookie"
          ]
        ).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              "af_session="
            ),
            expect.stringContaining(
              "HttpOnly"
            ),
          ])
        );
      }
    );

    test(
      "recusa Bearer inválido antes de criar cookie",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .post(
              "/auth/migrar-sessao-legada"
            )
            .set(
              "Authorization",
              "Bearer invalido"
            );

        expect(
          resposta.status
        ).toBe(401);

        expect(
          resposta.headers[
            "set-cookie"
          ]
        ).toBeUndefined();
      }
    );
  }
);
