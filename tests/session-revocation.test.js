process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "teste-revogacao-jwt-secret-com-mais-de-32-caracteres";

const express = require(
  "express"
);
const jwt = require(
  "jsonwebtoken"
);
const request = require(
  "supertest"
);

jest.mock(
  "../src/repositories/authSessionRepository",
  () => ({
    buscarEstadoDaSessao:
      jest.fn(),
  })
);

jest.mock(
  "../src/repositories/sessionRevocationRepository",
  () => ({
    revogarToken:
      jest.fn(),
  })
);

const authSessionRepository =
  require(
    "../src/repositories/authSessionRepository"
  );
const sessionRevocationRepository =
  require(
    "../src/repositories/sessionRevocationRepository"
  );
const auth = require(
  "../src/middlewares/auth"
);
const revogarSessao = require(
  "../src/middlewares/revogarSessao"
);

function gerarToken(
  usuarioId = 1
) {
  return jwt.sign(
    {
      id: usuarioId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );
}

function criarAppProtegido() {
  const app = express();

  app.get(
    "/protegida",
    auth,
    (_req, res) =>
      res.status(200).json({
        ok: true,
      })
  );

  return app;
}

function criarAppLogout() {
  const app = express();

  app.post(
    "/logout",
    revogarSessao,
    (_req, res) =>
      res.status(204).end()
  );

  app.use(
    (erro, _req, res, _next) =>
      res.status(500).json({
        erro: erro.message,
      })
  );

  return app;
}

describe(
  "Revogação de sessão",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      authSessionRepository
        .buscarEstadoDaSessao
        .mockResolvedValue({
          id: 1,
          ativo: true,
          senha_alterada_em: null,
          token_revogado: false,
        });

      sessionRevocationRepository
        .revogarToken
        .mockResolvedValue({
          id: 10,
          usuario_id: 1,
        });
    });

    test(
      "recusa um JWT previamente revogado",
      async () => {
        authSessionRepository
          .buscarEstadoDaSessao
          .mockResolvedValue({
            id: 1,
            ativo: true,
            senha_alterada_em: null,
            token_revogado: true,
          });

        const resposta =
          await request(
            criarAppProtegido()
          )
            .get("/protegida")
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            );

        expect(
          resposta.status
        ).toBe(401);
        expect(
          resposta.body.erro
        ).toBe(
          "Sessão inválida ou encerrada."
        );
      }
    );

    test(
      "CA-AUT-03: logout revoga a sessão e o mesmo token deixa de autorizar recursos privados",
      async () => {
        const token =
          gerarToken();

        const antesDoLogout =
          await request(
            criarAppProtegido()
          )
            .get("/protegida")
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          antesDoLogout.status
        ).toBe(200);

        const logout =
          await request(
            criarAppLogout()
          )
            .post("/logout")
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(logout.status)
          .toBe(204);
        expect(
          sessionRevocationRepository
            .revogarToken
        ).toHaveBeenCalledTimes(1);

        authSessionRepository
          .buscarEstadoDaSessao
          .mockResolvedValue({
            id: 1,
            ativo: true,
            senha_alterada_em: null,
            token_revogado: true,
          });

        const depoisDoLogout =
          await request(
            criarAppProtegido()
          )
            .get("/protegida")
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          depoisDoLogout.status
        ).toBe(401);
        expect(
          depoisDoLogout.body.erro
        ).toBe(
          "Sessão inválida ou encerrada."
        );
      }
    );

    test(
      "registra somente o hash do token no logout",
      async () => {
        const token =
          gerarToken();

        const resposta =
          await request(
            criarAppLogout()
          )
            .post("/logout")
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          resposta.status
        ).toBe(204);

        expect(
          sessionRevocationRepository
            .revogarToken
        ).toHaveBeenCalledTimes(1);

        const argumento =
          sessionRevocationRepository
            .revogarToken
            .mock.calls[0][0];

        expect(argumento.usuarioId)
          .toBe(1);
        expect(argumento.tokenHash)
          .toMatch(/^[0-9a-f]{64}$/);
        expect(argumento.tokenHash)
          .not.toBe(token);
        expect(argumento.expiraEm)
          .toBeInstanceOf(Date);
      }
    );

    test(
      "mantém logout idempotente quando não existe token",
      async () => {
        const resposta =
          await request(
            criarAppLogout()
          )
            .post("/logout");

        expect(
          resposta.status
        ).toBe(204);
        expect(
          sessionRevocationRepository
            .revogarToken
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "não persiste token expirado",
      async () => {
        const token = jwt.sign(
          {
            id: 1,
          },
          process.env.JWT_SECRET,
          {
            expiresIn: -1,
          }
        );

        const resposta =
          await request(
            criarAppLogout()
          )
            .post("/logout")
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          resposta.status
        ).toBe(204);
        expect(
          sessionRevocationRepository
            .revogarToken
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "não mascara falha inesperada ao persistir a revogação",
      async () => {
        sessionRevocationRepository
          .revogarToken
          .mockRejectedValueOnce(
            new Error(
              "Banco indisponível"
            )
          );

        const resposta =
          await request(
            criarAppLogout()
          )
            .post("/logout")
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            );

        expect(
          resposta.status
        ).toBe(500);
        expect(
          resposta.body.erro
        ).toBe(
          "Banco indisponível"
        );
        expect(
          resposta.headers[
            "set-cookie"
          ]
        ).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              "af_session=;"
            ),
          ])
        );
      }
    );
  }
);
