const request = require("supertest");
const app = require("../src/server");

describe("Serviços", () => {
  test("deve retornar 401 ao listar serviços sem token", async () => {
    const response = await request(app).get("/servicos");

    expect(response.statusCode).toBe(401);
    expect(response.body).toHaveProperty("erro");
  });
});