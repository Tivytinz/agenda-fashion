const request = require("supertest");
const app = require("../src/server");

describe("Fluxo cliente logado", () => {
  test("cliente autenticado consegue listar seus agendamentos", async () => {
    const login = await request(app)
      .post("/login")
      .send({
        email: "cliente@gmail.com",
        senha: "1234567"
      }, 1500);

    expect(login.statusCode).toBe(200);

    const token = login.body.token;

    const response = await request(app)
      .get("/meus-agendamentos")
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("agendamentos");
    expect(Array.isArray(response.body.agendamentos)).toBe(true);
  });
});