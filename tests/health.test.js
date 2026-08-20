const request = require("supertest");
const readinessService = require(
  "../src/services/readinessService"
);
const registrador = require(
  "../src/utils/registrador"
);
const app = require("../src/server");

describe("Health check", () => {
  it("deve carregar a página inicial", async () => {
    const res = await request(app).get("/");

    expect(res.statusCode).toBe(200);
  });

  it(
    "expõe liveness e headers de segurança",
    async () => {
      const res =
        await request(app)
          .get(
            "/health/live"
          );

      expect(
        res.statusCode
      ).toBe(200);

      expect(
        res.body
      ).toEqual({
        status: "ok",
      });

      expect(
        res.headers[
          "x-request-id"
        ]
      ).toBeTruthy();

      expect(
        res.headers[
          "x-content-type-options"
        ]
      ).toBe(
        "nosniff"
      );

      expect(
        res.headers[
          "content-security-policy"
        ]
      ).toContain(
        "script-src 'self'"
      );
    }
  );

  it(
    "registra diagnóstico seguro quando o PostgreSQL não está pronto",
    async () => {
      const verificar = jest
        .spyOn(
          readinessService,
          "verificarBanco"
        )
        .mockRejectedValue(
          Object.assign(
            new Error(
              "detalhe interno não deve ir para a resposta"
            ),
            {
              code: "08006",
            }
          )
        );

      const aviso = jest
        .spyOn(
          registrador,
          "aviso"
        )
        .mockImplementation();

      try {
        const res =
          await request(app)
            .get(
              "/health/ready"
            );

        expect(res.statusCode)
          .toBe(503);
        expect(res.body)
          .toEqual({
            status:
              "unavailable",
            database:
              "error",
          });
        expect(aviso)
          .toHaveBeenCalledWith(
            "Healthcheck: PostgreSQL indisponível.",
            expect.objectContaining({
              request_id:
                expect.any(String),
              codigo:
                "08006",
              tipo:
                "Error",
            })
          );
      } finally {
        aviso.mockRestore();
        verificar.mockRestore();
      }
    }
  );
});
