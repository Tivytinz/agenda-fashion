const request = require("supertest");
const app = require("../src/server");

describe("Autenticação", () => {
  test("deve retornar 401 para login inválido", async () => {
    const response = await request(app)
      .post("/login")
      .send({
        email: "naoexiste@email.com",
        senha: "123456",
      });

    expect(response.statusCode).toBe(401);
  });
});