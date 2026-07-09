const request = require("supertest");
const app = require("../src/server");

describe("Health check", () => {
  it("deve carregar a página inicial", async () => {
    const res = await request(app).get("/");

    expect(res.statusCode).toBe(200);
  });
});