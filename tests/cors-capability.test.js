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
              "https://agendafashion.com.br"
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
          "https://agendafashion.com.br"
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

  test.each(["GET", "PUT"])(
    "permite preflight da agenda com X-AF-Contexto via %s, sem liberar outros headers",
    async (method) => {
      const resposta = await request(app)
        .options("/agenda-configuracao")
        .set("Origin", "https://agendafashion.com.br")
        .set("Access-Control-Request-Method", method)
        .set("Access-Control-Request-Headers", "X-AF-Contexto");

      expect(resposta.status).toBe(204);
      expect(resposta.headers["access-control-allow-origin"]).toBe(
        "https://agendafashion.com.br"
      );
      expect(resposta.headers["access-control-allow-credentials"]).toBe("true");
      const allowed = String(resposta.headers["access-control-allow-headers"] || "")
        .toLowerCase()
        .split(",")
        .map((header) => header.trim());
      expect(allowed).toContain("x-af-contexto");
      expect(allowed).not.toContain("x-af-administrador");
    }
  );

  test("preflight não concede acesso à agenda sem autenticação", async () => {
    const resposta = await request(app)
      .get("/agenda-configuracao")
      .set("Origin", "https://agendafashion.com.br")
      .set("X-AF-Contexto", "dono");

    expect(resposta.status).toBe(401);
    expect(resposta.headers["access-control-allow-origin"]).toBe(
      "https://agendafashion.com.br"
    );
  });
