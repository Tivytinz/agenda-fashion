const canonicalHostRedirect = require(
  "../src/middlewares/canonicalHostRedirect"
);

describe(
  "redirect do domínio canônico",
  () => {
    const publicAppUrlOriginal =
      process.env.PUBLIC_APP_URL;

    afterEach(() => {
      if (
        publicAppUrlOriginal ===
        undefined
      ) {
        delete process.env
          .PUBLIC_APP_URL;
      } else {
        process.env
          .PUBLIC_APP_URL =
          publicAppUrlOriginal;
      }
    });

    function criarResposta() {
      return {
        redirect:
          jest.fn(),
      };
    }

    test(
      "redireciona navegação HTML do subdomínio legado preservando rota e query",
      () => {
        process.env.PUBLIC_APP_URL =
          "https://agendafashion.com.br";

        const req = {
          method: "GET",
          hostname:
            "app.agendafashion.com.br",
          originalUrl:
            "/painel/agenda?utm_source=legado",
          headers: {
            accept:
              "text/html,application/xhtml+xml",
          },
        };
        const res =
          criarResposta();
        const next =
          jest.fn();

        canonicalHostRedirect(
          req,
          res,
          next
        );

        expect(
          res.redirect
        ).toHaveBeenCalledWith(
          308,
          "https://agendafashion.com.br/painel/agenda?utm_source=legado"
        );
        expect(next)
          .not
          .toHaveBeenCalled();
      }
    );

    test(
      "não redireciona chamadas de API no host legado",
      () => {
        process.env.PUBLIC_APP_URL =
          "https://agendafashion.com.br";

        const req = {
          method: "GET",
          hostname:
            "app.agendafashion.com.br",
          originalUrl:
            "/perfil-negocio/studio",
          headers: {
            accept:
              "application/json",
          },
        };
        const res =
          criarResposta();
        const next =
          jest.fn();

        canonicalHostRedirect(
          req,
          res,
          next
        );

        expect(
          res.redirect
        ).not.toHaveBeenCalled();
        expect(next)
          .toHaveBeenCalledTimes(1);
      }
    );

    test(
      "não redireciona quando a requisição já usa o domínio canônico",
      () => {
        process.env.PUBLIC_APP_URL =
          "https://agendafashion.com.br";

        const req = {
          method: "GET",
          hostname:
            "agendafashion.com.br",
          originalUrl: "/",
          headers: {
            accept:
              "text/html",
          },
        };
        const res =
          criarResposta();
        const next =
          jest.fn();

        canonicalHostRedirect(
          req,
          res,
          next
        );

        expect(
          res.redirect
        ).not.toHaveBeenCalled();
        expect(next)
          .toHaveBeenCalledTimes(1);
      }
    );

    test(
      "usa fallback seguro quando PUBLIC_APP_URL é inválida",
      () => {
        process.env.PUBLIC_APP_URL =
          "javascript:alert(1)";

        expect(
          canonicalHostRedirect
            .obterOrigemCanonica()
        ).toBe(
          "https://agendafashion.com.br"
        );
      }
    );
  }
);
