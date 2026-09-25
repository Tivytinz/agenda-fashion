const request = require("supertest");
const app = require("../src/server");

describe("SEO e 404 das rotas React", () => {
  test.each([
    "/entrar",
    "/cadastro",
    "/confirmar",
    "/sucesso",
    "/checkout",
    "/esqueci-senha",
    "/redefinir-senha",
    "/convites",
    "/agendamento-acesso/123",
    "/agendamento-visitante/123",
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

  test("robots bloqueia rotas privadas e sensíveis", async () => {
    const resposta = await request(app)
      .get("/robots.txt")
      .set("Accept", "text/plain");

    expect(resposta.status).toBe(200);
    expect(resposta.text).toContain("Disallow: /esqueci-senha");
    expect(resposta.text).toContain("Disallow: /redefinir-senha");
    expect(resposta.text).toContain("Disallow: /convites");
    expect(resposta.text).toContain("Disallow: /agendamento-acesso/");
    expect(resposta.text).toContain("Disallow: /agendamento-visitante/");
  });

  test("entrega metadata server-side da landing profissional sem UTM no canonical", async () => {
    const resposta = await request(app)
      .get(
        "/para-profissionais?utm_source=google&utm_medium=cpc&utm_campaign=profissionais"
      )
      .set("Accept", "text/html");

    expect(resposta.status).toBe(200);
    expect(resposta.headers["content-type"])
      .toMatch(/text\/html/);
    expect(resposta.text).toContain(
      "<title>Agenda online grátis para profissionais | Agenda Fashion</title>"
    );
    expect(resposta.text).toContain(
      'name="description" content="Agenda online grátis para nail designers, lash designers, designers de sobrancelhas, manicures, esteticistas e salões. Receba agendamentos e, se autorizar, avisos pelo WhatsApp."'
    );
    expect(resposta.text).toContain(
      'rel="canonical" href="https://app.agendafashion.com.br/para-profissionais"'
    );
    expect(resposta.text).toContain(
      'property="og:title" content="Agenda online grátis para profissionais | Agenda Fashion"'
    );
    expect(resposta.text).toContain(
      'property="og:image" content="https://app.agendafashion.com.br/social-preview.png"'
    );
    expect(resposta.text).toContain(
      'name="twitter:card" content="summary_large_image"'
    );
    expect(resposta.headers["cache-control"])
      .toContain("no-store");
    expect(resposta.text).not.toContain(
      "utm_source=google"
    );
  });

  test("normaliza barra final no canonical da landing profissional", async () => {
    const resposta = await request(app)
      .get("/para-profissionais/")
      .set("Accept", "text/html");

    expect(resposta.status).toBe(200);
    expect(resposta.text).toContain(
      'rel="canonical" href="https://app.agendafashion.com.br/para-profissionais"'
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
