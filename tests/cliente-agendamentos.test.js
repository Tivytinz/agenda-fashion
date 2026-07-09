const request = require("supertest");
const app = require("../src/server");

describe("Fluxo cliente logado", () => {
  test("cliente cadastrado consegue listar seus agendamentos", async () => {
    const email = `cliente_${Date.now()}@teste.com`;

    await request(app)
      .post("/cadastro")
      .send({
        nome: "Cliente Teste",
        email,
        senha: "123456",
        whatsapp: `62999${Date.now()}`,
        tipo: "cliente"
      });

    const login = await request(app)
      .post("/login")
      .send({
        email,
        senha: "123456"
      });

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