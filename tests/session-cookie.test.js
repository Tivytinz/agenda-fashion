const jwt = require(
  "jsonwebtoken"
);

const {
  COOKIE_DESENVOLVIMENTO,
  COOKIE_PRODUCAO,
  definirCookieSessao,
  obterNomeCookie,
  obterTokenDaRequisicao,
} = require(
  "../src/config/sessionCookie"
);

describe(
  "cookie seguro da sessão",
  () => {
    const ambienteOriginal =
      process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV =
        ambienteOriginal;
    });

    test(
      "usa prefixo __Host e Secure em produção",
      () => {
        process.env.NODE_ENV =
          "production";

        const token =
          jwt.sign(
            {
              id: 1,
            },
            "segredo-de-teste-com-mais-de-32-caracteres",
            {
              expiresIn: "1h",
            }
          );

        const res = {
          cookie:
            jest.fn(),
        };

        definirCookieSessao(
          res,
          token
        );

        expect(
          obterNomeCookie()
        ).toBe(
          COOKIE_PRODUCAO
        );

        expect(
          res.cookie
        ).toHaveBeenCalledWith(
          COOKIE_PRODUCAO,
          token,
          expect.objectContaining({
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge:
              expect.any(Number),
          })
        );
      }
    );

    test(
      "lê cookie local e preserva Bearer como compatibilidade prioritária",
      () => {
        process.env.NODE_ENV =
          "test";

        expect(
          obterTokenDaRequisicao({
            headers: {
              cookie:
                `${COOKIE_DESENVOLVIMENTO}=token-cookie`,
            },
          })
        ).toEqual({
          token: "token-cookie",
          origem: "cookie",
        });

        expect(
          obterTokenDaRequisicao({
            headers: {
              authorization:
                "Bearer token-legado",
              cookie:
                `${COOKIE_DESENVOLVIMENTO}=token-cookie`,
            },
          })
        ).toEqual({
          token: "token-legado",
          origem: "bearer",
        });
      }
    );
  }
);
