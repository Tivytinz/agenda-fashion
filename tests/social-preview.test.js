jest.mock("../src/repositories/perfilNegocioRepository");

const request = require("supertest");
const perfilNegocioRepository = require(
  "../src/repositories/perfilNegocioRepository"
);
const socialPreviewService = require(
  "../src/services/socialPreviewService"
);
const app = require("../src/server");

const NEGOCIO = {
  id: 7,
  nome: 'Beauty <Vanessa> "Studio"',
  slug: "beauty-vanessa",
  descricao: "Beleza & cuidado",
  foto_url: "https://cdn.teste/negocio.jpg"
};

describe("prévia social dos links públicos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    perfilNegocioRepository.buscarNegocioPorSlug
      .mockResolvedValue(NEGOCIO);
    perfilNegocioRepository.buscarServicos
      .mockResolvedValue([
        {
          id: 11,
          nome: "Manicure Premium",
          descricao: "Cuidado completo",
          valor: "55.00",
          duracao_minutos: 60,
          foto_url: "https://cdn.teste/servico.jpg"
        }
      ]);
  });

  test("gera metadados do negócio com conteúdo escapado", () => {
    const metadados = socialPreviewService.montarMetadados({
      negocio: NEGOCIO,
      servico: null
    });
    const html = socialPreviewService.injetarMetadados(
      "<html><head><meta name=\"description\" content=\"genérica\"><title>Agenda Fashion</title></head><body></body></html>",
      metadados
    );

    expect(html).toContain(
      '<title>Beauty &lt;Vanessa&gt; &quot;Studio&quot;</title>'
    );
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:url" content="https://app.agendafashion.com.br/negocio/beauty-vanessa"');
    expect(html).not.toContain("content=\"genérica\"");
  });

  test("usa o serviço válido do próprio negócio", async () => {
    const previa = await socialPreviewService.buscarPrevia({
      slug: "beauty-vanessa",
      servicoId: "11"
    });

    expect(previa.servico.nome).toBe("Manicure Premium");
    expect(previa.metadados.titulo).toBe(
      "Manicure Premium | Beauty <Vanessa> \"Studio\""
    );
    expect(previa.metadados.imagem).toBe(
      "https://cdn.teste/servico.jpg"
    );
    expect(previa.metadados.url).toBe(
      "https://app.agendafashion.com.br/negocio/beauty-vanessa?servico=11"
    );
  });

  test("ignora serviço inexistente em vez de anunciar dados errados", async () => {
    const previa = await socialPreviewService.buscarPrevia({
      slug: "beauty-vanessa",
      servicoId: "999"
    });

    expect(previa.servico).toBeNull();
    expect(previa.metadados.titulo).toBe(NEGOCIO.nome);
    expect(previa.metadados.url).not.toContain("servico=");
  });

  test("redireciona slug antigo preservando campanha e serviço", async () => {
    const resposta = await request(app).get(
      "/negocio/victor?servico=11&utm_source=whatsapp"
    );

    expect(resposta.status).toBe(301);
    expect(resposta.headers.location).toBe(
      "/negocio/beauty-vanessa?servico=11&utm_source=whatsapp"
    );
  });

  test("entrega ao robô o HTML do serviço com Open Graph", async () => {
    const resposta = await request(app).get(
      "/negocio/beauty-vanessa?servico=11&utm_source=whatsapp"
    );

    expect(resposta.status).toBe(200);
    expect(resposta.headers["content-type"]).toMatch(/text\/html/);
    expect(resposta.headers["cache-control"]).toContain("no-store");
    expect(resposta.text).toContain(
      '<title>Manicure Premium | Beauty &lt;Vanessa&gt; &quot;Studio&quot;</title>'
    );
    expect(resposta.text).toContain(
      'property="og:image" content="https://cdn.teste/servico.jpg"'
    );
    expect(resposta.text).toContain(
      'rel="canonical" href="https://app.agendafashion.com.br/negocio/beauty-vanessa?servico=11"'
    );
    expect(resposta.text).not.toContain("utm_source");
  });

  test("entrega uma imagem PNG padrão com cache", async () => {
    const resposta = await request(app).get("/social-preview.png");

    expect(resposta.status).toBe(200);
    expect(resposta.headers["content-type"]).toMatch(/image\/png/);
    expect(resposta.headers["cache-control"]).toContain("max-age=86400");
    expect(resposta.body.subarray(1, 4).toString()).toBe("PNG");
  });
});
