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

    test.each([
      ["app.agendafashion.com.br", "GET"],
      ["www.agendafashion.com.br", "GET"],
      ["www.agendafashion.com.br", "HEAD"],
    ])(
      "redireciona HTML de %s via %s preservando rota e query",
      (hostname, method) => {
        process.env.PUBLIC_APP_URL =
          "https://agendafashion.com.br";

        const req = {
          method,
          hostname,
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

    test.each([
      ["app.agendafashion.com.br", "GET", "application/json"],
      ["www.agendafashion.com.br", "GET", "application/json"],
      ["www.agendafashion.com.br", "POST", "text/html"],
      ["app.agendafashion.com.br", "POST", "text/html"],
    ])(
      "preserva API/mutação de %s via %s com Accept %s",
      (hostname, method, accept) => {
        process.env.PUBLIC_APP_URL =
          "https://agendafashion.com.br";

        const req = {
          method,
          hostname,
          originalUrl:
            "/perfil-negocio/studio",
          headers: {
            accept,
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
