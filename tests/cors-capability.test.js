const request = require(
  "supertest"
);

const app = require(
  "../src/server"
);

describe(
  "CORS do header de capability",
  () => {
    test(
      "autoriza X-Agenda-Access no preflight de origem permitida",
      async () => {
        const resposta =
          await request(app)
            .options(
              "/agendamento-visitante/123"
            )
            .set(
              "Origin",
              "https://app.agendafashion.com.br"
            )
            .set(
              "Access-Control-Request-Method",
              "GET"
            )
            .set(
              "Access-Control-Request-Headers",
              "X-Agenda-Access"
            );

        expect(
          resposta.status
        ).toBe(204);

        expect(
          resposta.headers[
            "access-control-allow-origin"
          ]
        ).toBe(
          "https://app.agendafashion.com.br"
        );

        expect(
          String(
            resposta.headers[
              "access-control-allow-headers"
            ] || ""
          )
            .toLowerCase()
        ).toContain(
          "x-agenda-access"
        );
      }
    );
  }
);
