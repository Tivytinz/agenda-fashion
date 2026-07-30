const request = require("supertest");
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
    }
  );
});
