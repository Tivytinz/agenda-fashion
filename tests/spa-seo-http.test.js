const request = require("supertest");
const app = require("../src/server");

describe("SEO e 404 das rotas React", () => {
  test.each([
    "/entrar",
    "/cadastro",
    "/confirmar",
    "/sucesso",
    "/checkout",
    "/painel",
    "/painel/agenda",
    "/profissional/agenda",
    "/admin/trafego-pago"
  ])("marca %s como noindex", async (rota) => {
    const resposta = await request(app)
      .get(rota)
      .set("Accept", "text/html");

    expect(resposta.status).toBe(200);
    expect(resposta.headers["content-type"]).toMatch(/text\/html/);
    expect(resposta.text).toContain(
      'name="robots" content="noindex,follow"'
    );
  });

  test("mantém página pública indexável", async () => {
    const resposta = await request(app)
      .get("/planos")
      .set("Accept", "text/html");

    expect(resposta.status).toBe(200);
    expect(resposta.headers["content-type"]).toMatch(/text\/html/);
    expect(resposta.text).toContain('<div id="root"></div>');
    expect(resposta.text).not.toContain(
      'name="robots" content="noindex,follow"'
    );
  });

  test("mantém a consulta JSON de planos para o frontend", async () => {
    const resposta = await request(app)
      .get("/planos")
      .set("Accept", "application/json");

    expect(resposta.headers["content-type"])
      .toMatch(/application\/json/);
  });

  test("entrega a página de planos para robôs com Accept genérico", async () => {
    const resposta = await request(app)
      .get("/planos")
      .set("Accept", "*/*");

    expect(resposta.status).toBe(200);
    expect(resposta.headers["content-type"])
      .toMatch(/text\/html/);
    expect(resposta.text)
      .toContain('<div id="root"></div>');
  });

  test("rota HTML desconhecida devolve documento React com status 404", async () => {
    const resposta = await request(app)
      .get("/pagina-que-nao-existe")
      .set("Accept", "text/html");

    expect(resposta.status).toBe(404);
    expect(resposta.headers["content-type"]).toMatch(/text\/html/);
    expect(resposta.text).toContain('<div id="root"></div>');
    expect(resposta.text).toContain(
      'name="robots" content="noindex,follow"'
    );
  });

  test("rota desconhecida pedida como API continua devolvendo JSON", async () => {
    const resposta = await request(app)
      .get("/endpoint-que-nao-existe")
      .set("Accept", "application/json");

    expect(resposta.status).toBe(404);
    expect(resposta.headers["content-type"]).toMatch(/application\/json/);
    expect(resposta.body).toMatchObject({
      erro: "Rota nao encontrada.",
      metodo: "GET"
    });
  });
});
