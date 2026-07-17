const express = require(
  "express"
);

const request = require(
  "supertest"
);

jest.mock(
  "../src/db/db",
  () => ({
    query:
      jest.fn(),
  })
);

const db = require(
  "../src/db/db"
);

const authAdmin = require(
  "../src/middlewares/authAdmin"
);

function criarApp() {
  const app =
    express();

  app.use(
    express.json()
  );

  /*
   * Simula o resultado do middleware auth.
   *
   * Nos testes reais do sistema, o auth
   * preenche req.user usando o JWT.
   */
  app.use(
    (
      req,
      res,
      next
    ) => {
      const usuarioId =
        req.headers[
          "x-test-user-id"
        ];

      if (
        usuarioId !==
        undefined
      ) {
        req.user = {
          id:
            usuarioId,
        };
      }

      return next();
    }
  );

  app.get(
    "/admin/teste",
    authAdmin,
    (
      req,
      res
    ) => {
      return res
        .status(200)
        .json({
          mensagem:
            "Acesso administrativo autorizado.",

          admin:
            req.admin,
        });
    }
  );

  app.use(
    (
      erro,
      req,
      res,
      next
    ) => {
      const statusCode =
        Number(
          erro?.statusCode ||
          erro?.status
        ) || 500;

      return res
        .status(statusCode)
        .json({
          erro:
            statusCode === 500
              ? "Erro interno do servidor."
              : erro.message,
        });
    }
  );

  return app;
}

describe(
  "Middleware authAdmin",
  () => {
    let app;

    beforeEach(() => {
      jest.clearAllMocks();

      app =
        criarApp();
    });

    test(
      "retorna 401 quando o usuário não foi autenticado",
      async () => {
        const resposta =
          await request(app)
            .get(
              "/admin/teste"
            );

        expect(
          resposta.status
        ).toBe(401);

        expect(
          resposta.body
        ).toEqual({
          erro:
            "Usuário não autenticado.",
        });

        expect(
          db.query
        ).not.toHaveBeenCalled();
      }
    );

    test.each([
      "abc",
      "0",
      "-1",
      "1.5",
      "",
    ])(
      "retorna 401 para id de usuário inválido: %s",
      async (
        usuarioId
      ) => {
        const resposta =
          await request(app)
            .get(
              "/admin/teste"
            )
            .set(
              "x-test-user-id",
              usuarioId
            );

        expect(
          resposta.status
        ).toBe(401);

        expect(
          resposta.body.erro
        ).toBe(
          "Usuário não autenticado."
        );

        expect(
          db.query
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 403 quando o usuário não é administrador",
      async () => {
        db.query
          .mockResolvedValue({
            rows:
              [],
          });

        const resposta =
          await request(app)
            .get(
              "/admin/teste"
            )
            .set(
              "x-test-user-id",
              "7"
            );

        expect(
          resposta.status
        ).toBe(403);

        expect(
          resposta.body
        ).toEqual({
          erro:
            "Acesso restrito aos administradores da plataforma.",
        });

        expect(
          db.query
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          db.query
            .mock.calls[0][1]
        ).toEqual([
          7,
        ]);
      }
    );

    test(
      "autoriza administrador ativo",
      async () => {
        db.query
          .mockResolvedValue({
            rows: [
              {
                usuario_id:
                  7,

                papel:
                  "admin",
              },
            ],
          });

        const resposta =
          await request(app)
            .get(
              "/admin/teste"
            )
            .set(
              "x-test-user-id",
              "7"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          resposta.body
        ).toEqual({
          mensagem:
            "Acesso administrativo autorizado.",

          admin: {
            usuarioId:
              7,

            papel:
              "admin",

            superadmin:
              false,
          },
        });

        expect(
          db.query
        ).toHaveBeenCalledTimes(
          1
        );

        const [
          sql,
          parametros,
        ] =
          db.query
            .mock.calls[0];

        expect(
          sql
        ).toContain(
          "usuarios_administradores"
        );

        expect(
          sql
        ).toContain(
          "ua.ativo = TRUE"
        );

        expect(
          sql
        ).toContain(
          "u.ativo = TRUE"
        );

        expect(
          parametros
        ).toEqual([
          7,
        ]);
      }
    );

    test(
      "autoriza superadministrador e identifica seu nível",
      async () => {
        db.query
          .mockResolvedValue({
            rows: [
              {
                usuario_id:
                  "12",

                papel:
                  "superadmin",
              },
            ],
          });

        const resposta =
          await request(app)
            .get(
              "/admin/teste"
            )
            .set(
              "x-test-user-id",
              "12"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          resposta.body.admin
        ).toEqual({
          usuarioId:
            12,

          papel:
            "superadmin",

          superadmin:
            true,
        });
      }
    );

    test(
      "não usa usuario.tipo para liberar o acesso",
      async () => {
        db.query
          .mockResolvedValue({
            rows:
              [],
          });

        const appComTipo =
          express();

        appComTipo.get(
          "/admin/teste",
          (
            req,
            res,
            next
          ) => {
            req.user = {
              id:
                20,

              tipo:
                "admin",
            };

            return next();
          },
          authAdmin,
          (
            req,
            res
          ) => {
            return res.json({
              autorizado:
                true,
            });
          }
        );

        appComTipo.use(
          (
            erro,
            req,
            res,
            next
          ) => {
            return res
              .status(
                erro.statusCode ||
                500
              )
              .json({
                erro:
                  erro.message,
              });
          }
        );

        const resposta =
          await request(
            appComTipo
          ).get(
            "/admin/teste"
          );

        expect(
          resposta.status
        ).toBe(403);

        expect(
          resposta.body.erro
        ).toBe(
          "Acesso restrito aos administradores da plataforma."
        );

        expect(
          db.query
        ).toHaveBeenCalledWith(
          expect.any(
            String
          ),
          [
            20,
          ]
        );
      }
    );

    test(
      "encaminha falhas inesperadas do banco para o tratamento de erros",
      async () => {
        db.query
          .mockRejectedValue(
            new Error(
              "Banco indisponível"
            )
          );

        const resposta =
          await request(app)
            .get(
              "/admin/teste"
            )
            .set(
              "x-test-user-id",
              "7"
            );

        expect(
          resposta.status
        ).toBe(500);

        expect(
          resposta.body
        ).toEqual({
          erro:
            "Erro interno do servidor.",
        });
      }
    );
  }
);