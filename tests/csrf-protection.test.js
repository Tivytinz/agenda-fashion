const express = require(
  "express"
);
const request = require(
  "supertest"
);

const {
  csrfProtection,
} = require(
  "../src/middlewares/csrfProtection"
);

function criarApp() {
  const app =
    express();

  app.use(
    csrfProtection
  );

  app.all(
    "/recurso",
    (_req, res) => {
      res.status(200).json({
        ok: true,
      });
    }
  );

  app.use(
    (
      erro,
      _req,
      res,
      _next
    ) => {
      res
        .status(
          erro.statusCode ||
          500
        )
        .json({
          erro:
            erro.message,
          codigo:
            erro.codigo,
        });
    }
  );

  return app;
}

describe(
  "proteção CSRF por origem",
  () => {
    test(
      "não interfere em método seguro com cookie",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .get("/recurso")
            .set(
              "Cookie",
              "af_session=token"
            );

        expect(
          resposta.status
        ).toBe(200);
      }
    );

    test(
      "não interfere em mutação sem cookie de sessão",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .post("/recurso")
            .set(
              "Origin",
              "https://site-externo.test"
            );

        expect(
          resposta.status
        ).toBe(200);
      }
    );

    test(
      "aceita mutação same-origin com cookie",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .post("/recurso")
            .set(
              "Host",
              "app.agendafashion.com.br"
            )
            .set(
              "X-Forwarded-Proto",
              "https"
            )
            .set(
              "Origin",
              "https://app.agendafashion.com.br"
            )
            .set(
              "Cookie",
              "af_session=token"
            );

        expect(
          resposta.status
        ).toBe(200);
      }
    );

    test(
      "recusa origem externa em mutação autenticada por cookie",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .post("/recurso")
            .set(
              "Host",
              "app.agendafashion.com.br"
            )
            .set(
              "X-Forwarded-Proto",
              "https"
            )
            .set(
              "Origin",
              "https://site-externo.test"
            )
            .set(
              "Cookie",
              "af_session=token"
            );

        expect(
          resposta.status
        ).toBe(403);

        expect(
          resposta.body
        ).toMatchObject({
          codigo:
            "CSRF_ORIGIN_INVALID",
        });
      }
    );

    test(
      "recusa Sec-Fetch-Site cross-site mesmo sem Origin",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .patch("/recurso")
            .set(
              "Sec-Fetch-Site",
              "cross-site"
            )
            .set(
              "Cookie",
              "__Host-af_session=token"
            );

        expect(
          resposta.status
        ).toBe(403);
      }
    );

    test(
      "recusa Referer externo quando Origin está ausente",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .delete("/recurso")
            .set(
              "Host",
              "app.agendafashion.com.br"
            )
            .set(
              "X-Forwarded-Proto",
              "https"
            )
            .set(
              "Referer",
              "https://site-externo.test/form"
            )
            .set(
              "Cookie",
              "af_session=token"
            );

        expect(
          resposta.status
        ).toBe(403);
      }
    );

    test(
      "mantém compatibilidade quando cliente com cookie não envia metadados de origem",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .post("/recurso")
            .set(
              "Cookie",
              "af_session=token"
            );

        expect(
          resposta.status
        ).toBe(200);
      }
    );
  }
);
