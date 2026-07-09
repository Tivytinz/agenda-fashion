const request = require("supertest");
const app = require("../src/server");

describe("Cadastro", () => {
  test("deve retornar erro ao cadastrar sem campos obrigatórios", async () => {
    const response = await request(app)
      .post("/cadastro")
      .send({
        nome: "",
        email: "",
        senha: "",
        whatsapp: ""
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("erro");
  });
});