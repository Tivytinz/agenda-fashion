jest.mock(
  "../src/repositories/catalogoLocalRepository"
);
jest.mock(
  "../src/services/perfilNegocioService"
);
jest.mock(
  "../src/services/socialPreviewService",
  () => ({
    origemPublica: jest.fn(
      () => "https://app.agendafashion.com.br"
    )
  })
);

const repository = require(
  "../src/repositories/catalogoLocalRepository"
);
const perfilNegocioService = require(
  "../src/services/perfilNegocioService"
);
const service = require(
  "../src/services/catalogoLocalService"
);

describe("catálogo local SEO", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("resolve categoria, cidade e UF antes de consultar o catálogo", async () => {
    repository.buscarLocalidadePublica.mockResolvedValue({
      cidade: "Goiânia",
      estado: "GO"
    });
    perfilNegocioService.listarNegociosPublicos.mockResolvedValue({
      negocios: [
        {
          id: 1,
          nome: "Studio Rosa",
          cidade: "Goiânia",
          estado: "GO",
          servicos: []
        }
      ],
      paginacao: {
        pagina: 1,
        limite: 12,
        total: 1,
        tem_mais: false
      }
    });

    const resultado = await service.listarCatalogoLocal({
      categoria: "cabelo",
      localidade: "goiania-go",
      pagina: 1,
      limite: 12
    });

    expect(
      repository.buscarLocalidadePublica
    ).toHaveBeenCalledWith({
      cidadeSlug: "goiania",
      estado: "GO"
    });
    expect(
      perfilNegocioService.listarNegociosPublicos
    ).toHaveBeenCalledWith({
      categoria: "cabelo",
      cidade: "Goiânia",
      estado: "GO",
      pagina: 1,
      limite: 12
    });
    expect(resultado.filtro).toMatchObject({
      categoria: "cabelo",
      categoria_slug: "cabelo",
      cidade: "Goiânia",
      estado: "GO",
      localidade_slug: "goiania-go",
      caminho_canonico: "/servicos/cabelo/em/goiania-go"
    });
    expect(resultado.metadados.url).toBe(
      "https://app.agendafashion.com.br/servicos/cabelo/em/goiania-go"
    );
  });

  test("não publica combinações sem oferta", async () => {
    repository.buscarLocalidadePublica.mockResolvedValue({
      cidade: "Goiânia",
      estado: "GO"
    });
    perfilNegocioService.listarNegociosPublicos.mockResolvedValue({
      negocios: [],
      paginacao: {
        pagina: 1,
        limite: 12,
        total: 0,
        tem_mais: false
      }
    });

    await expect(
      service.listarCatalogoLocal({
        categoria: "cilios",
        localidade: "goiania-go"
      })
    ).rejects.toMatchObject({
      statusCode: 404
    });
  });

  test("cria página local canônica para bronzeamento", async () => {
    repository.buscarLocalidadePublica.mockResolvedValue({
      cidade: "Carápolis",
      estado: "SP"
    });
    perfilNegocioService.listarNegociosPublicos.mockResolvedValue({
      negocios: [{ id: 9, nome: "Sol e Cor", servicos: [] }],
      paginacao: {
        pagina: 1,
        limite: 12,
        total: 1,
        tem_mais: false
      }
    });

    const resultado = await service.listarCatalogoLocal({
      categoria: "bronzeamento",
      localidade: "carapolis-sp"
    });

    expect(
      perfilNegocioService.listarNegociosPublicos
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        categoria: "bronzeamento",
        cidade: "Carápolis",
        estado: "SP"
      })
    );
    expect(resultado.filtro.caminho_canonico).toBe(
      "/servicos/bronzeamento/em/carapolis-sp"
    );
    expect(resultado.metadados.titulo).toContain(
      "Bronzeamento em Carápolis - SP"
    );
  });

  test("rejeita categoria e localidade fora do padrão canônico", async () => {
    await expect(
      service.listarCatalogoLocal({
        categoria: "qualquer-coisa",
        localidade: "goiania-go"
      })
    ).rejects.toMatchObject({
      statusCode: 404
    });

    await expect(
      service.listarCatalogoLocal({
        categoria: "cabelo",
        localidade: "goiania"
      })
    ).rejects.toMatchObject({
      statusCode: 404
    });

    expect(
      repository.buscarLocalidadePublica
    ).not.toHaveBeenCalled();
  });

  test("sitemap contém negócios e apenas combinações locais existentes", async () => {
    repository.listarEntradasSitemap.mockResolvedValue([
      {
        slug: "studio-rosa",
        cidade: "Goiânia",
        estado: "GO",
        categoria: "cabelo",
        updated_at: "2026-08-11T10:00:00.000Z"
      },
      {
        slug: "studio-rosa",
        cidade: "Goiânia",
        estado: "GO",
        categoria: "cabelo",
        updated_at: "2026-08-11T11:00:00.000Z"
      },
      {
        slug: "espaco-lua",
        cidade: "Belém",
        estado: "PA",
        categoria: "outro",
        updated_at: "2026-08-10T10:00:00.000Z"
      }
    ]);

    const xml = await service.gerarSitemap();

    expect(xml).toContain(
      "https://app.agendafashion.com.br/negocio/studio-rosa"
    );
    expect(xml).toContain(
      "https://app.agendafashion.com.br/negocio/espaco-lua"
    );
    expect(xml).toContain(
      "https://app.agendafashion.com.br/servicos/cabelo/em/goiania-go"
    );
    expect(xml).not.toContain(
      "/servicos/outro/"
    );
    expect(
      xml.match(/\/servicos\/cabelo\/em\/goiania-go/g)
    ).toHaveLength(1);
  });

  test("robots aponta para o sitemap público", () => {
    expect(service.gerarRobotsTxt()).toContain(
      "Sitemap: https://app.agendafashion.com.br/sitemap.xml"
    );
  });
});
