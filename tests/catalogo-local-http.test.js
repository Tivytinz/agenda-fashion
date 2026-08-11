jest.mock(
  "../src/repositories/catalogoLocalRepository"
);
jest.mock(
  "../src/services/perfilNegocioService"
);

const request = require("supertest");
const repository = require(
  "../src/repositories/catalogoLocalRepository"
);
const perfilNegocioService = require(
  "../src/services/perfilNegocioService"
);
const app = require("../src/server");

const PAGINACAO_COM_RESULTADO = {
  pagina: 1,
  limite: 12,
  total: 1,
  tem_mais: false
};

describe("rotas HTTP do catálogo local", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    repository.buscarLocalidadePublica.mockResolvedValue({
      cidade: "Goiânia",
      estado: "GO"
    });
    perfilNegocioService.listarNegociosPublicos.mockResolvedValue({
      negocios: [
        {
          id: 1,
          nome: "Studio Rosa",
          slug: "studio-rosa",
          cidade: "Goiânia",
          estado: "GO",
          servicos: []
        }
      ],
      paginacao: PAGINACAO_COM_RESULTADO
    });
  });

  test("entrega HTML indexável com canonical para combinação válida", async () => {
    const resposta = await request(app).get(
      "/servicos/cabelo/em/goiania-go"
    );

    expect(resposta.status).toBe(200);
    expect(resposta.headers["content-type"]).toMatch(/text\/html/);
    expect(resposta.headers["cache-control"]).toContain("no-store");
    expect(resposta.text).toContain(
      "<title>Cabelo e barbearia em Goiânia - GO | Agenda Fashion</title>"
    );
    expect(resposta.text).toContain(
      'rel="canonical" href="https://app.agendafashion.com.br/servicos/cabelo/em/goiania-go"'
    );
    expect(resposta.text).not.toContain(
      'name="robots" content="noindex,follow"'
    );
  });

  test("responde JSON pela API usada pelo React", async () => {
    const resposta = await request(app).get(
      "/catalogo-local/cabelo/goiania-go?pagina=1&limite=12"
    );

    expect(resposta.status).toBe(200);
    expect(resposta.body.filtro).toMatchObject({
      categoria: "cabelo",
      cidade: "Goiânia",
      estado: "GO"
    });
  });

  test("combinação sem oferta vira 404 e recebe noindex", async () => {
    perfilNegocioService.listarNegociosPublicos.mockResolvedValue({
      negocios: [],
      paginacao: {
        pagina: 1,
        limite: 12,
        total: 0,
        tem_mais: false
      }
    });

    const resposta = await request(app).get(
      "/servicos/cabelo/em/goiania-go"
    );

    expect(resposta.status).toBe(404);
    expect(resposta.headers["content-type"]).toMatch(/text\/html/);
    expect(resposta.text).toContain(
      'name="robots" content="noindex,follow"'
    );
  });

  test("publica sitemap e robots", async () => {
    repository.listarEntradasSitemap.mockResolvedValue([
      {
        slug: "studio-rosa",
        cidade: "Goiânia",
        estado: "GO",
        categoria: "cabelo",
        updated_at: "2026-08-11T10:00:00.000Z"
      }
    ]);

    const [sitemap, robots] = await Promise.all([
      request(app).get("/sitemap.xml"),
      request(app).get("/robots.txt")
    ]);

    expect(sitemap.status).toBe(200);
    expect(sitemap.headers["content-type"]).toMatch(/xml/);
    expect(sitemap.text).toContain(
      "/servicos/cabelo/em/goiania-go"
    );

    expect(robots.status).toBe(200);
    expect(robots.headers["content-type"]).toMatch(/text\/plain/);
    expect(robots.text).toContain(
      "Sitemap: https://app.agendafashion.com.br/sitemap.xml"
    );
  });
});
