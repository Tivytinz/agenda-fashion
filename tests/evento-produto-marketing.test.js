jest.mock(
  "../src/repositories/eventoProdutoRepository",
  () => ({
    registrar: jest.fn(),
  })
);

const eventoProdutoRepository = require(
  "../src/repositories/eventoProdutoRepository"
);

const eventoProdutoService = require(
  "../src/services/eventoProdutoService"
);

describe("atribuição de marketing nos eventos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    eventoProdutoRepository.registrar.mockResolvedValue({ id: 101 });
  });

  test("preserva parâmetros de campanha permitidos e remove dados pessoais", async () => {
    const gclidLongo =
      "gclid_" + "A".repeat(120);

    await eventoProdutoService.registrar({
      corpo: {
        nome: "agendamento_concluido",
        pagina: "finalizar_agendamento",
        missao: "confirmar_agendamento",
        sessao_id: "sessao_marketing_123",
        negocio_id: 19,
        propriedades: {
          agendamento_id: 987654321,
          utm_source: "facebook",
          utm_medium: "cpc",
          utm_campaign: "goiania_cilios_agosto",
          utm_content: "video_01",
          utm_term: "lash_designer",
          gclid: gclidLongo,
          gbraid: "gbraid-google",
          wbraid: "wbraid-google",
          fbclid: "meta-click-id",
          msclkid: "microsoft-click-id",
          ttclid: "tiktok-click-id",
          epik: "pinterest-click-id",
          landing_page: "/negocio/studio-bella",
          referrer_host: "www.google.com",
          email: "cliente@example.com",
          telefone: "62999999999",
        },
      },
      usuarioId: null,
    });

    expect(eventoProdutoRepository.registrar).toHaveBeenCalledWith({
      nome: "agendamento_concluido",
      pagina: "finalizar_agendamento",
      missao: "confirmar_agendamento",
      sessaoId: "sessao_marketing_123",
      usuarioId: null,
      negocioId: 19,
      propriedades: {
        agendamento_id: 987654321,
        utm_source: "facebook",
        utm_medium: "cpc",
        utm_campaign: "goiania_cilios_agosto",
        utm_content: "video_01",
        utm_term: "lash_designer",
        gclid: gclidLongo,
        gbraid: "gbraid-google",
        wbraid: "wbraid-google",
        fbclid: "meta-click-id",
        msclkid: "microsoft-click-id",
        ttclid: "tiktok-click-id",
        epik: "pinterest-click-id",
        landing_page: "/negocio/studio-bella",
        referrer_host: "www.google.com",
      },
    });
  });

  test("aceita eventos da landing profissional e preserva os dois contatos", async () => {
    await eventoProdutoService.registrar({
      corpo: {
        nome: "landing_profissionais_cta_clicado",
        pagina: "para_profissionais",
        missao: "adquirir_profissional",
        sessao_id: "sessao_landing_123",
        propriedades: {
          posicao: "hero",
          utm_source: "meta",
          utm_medium: "cpc",
          utm_campaign: "profissionais_agosto",
          last_utm_source: "google",
          last_utm_medium: "cpc",
          last_utm_campaign: "remarketing_profissionais",
          last_gclid: "google-last-click",
          last_landing_page: "/para-profissionais",
          attribution_first_at: "2026-08-01T12:00:00.000Z",
          attribution_last_at: "2026-08-20T12:00:00.000Z",
        },
      },
      usuarioId: null,
    });

    expect(eventoProdutoRepository.registrar)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          nome: "landing_profissionais_cta_clicado",
          pagina: "para_profissionais",
          missao: "adquirir_profissional",
          propriedades: expect.objectContaining({
            posicao: "hero",
            utm_source: "meta",
            last_utm_source: "google",
            last_utm_campaign: "remarketing_profissionais",
            last_gclid: "google-last-click",
            last_landing_page: "/para-profissionais",
            attribution_first_at: "2026-08-01T12:00:00.000Z",
            attribution_last_at: "2026-08-20T12:00:00.000Z",
          }),
        })
      );
  });

  test("aceita visualização do catálogo local com contexto geográfico seguro", async () => {
    await eventoProdutoService.registrar({
      corpo: {
        nome: "catalogo_local_visualizado",
        pagina: "catalogo_local",
        missao: "descobrir_servico",
        sessao_id: "sessao_catalogo_123",
        propriedades: {
          categoria: "Cílios",
          categoria_slug: "cilios",
          cidade: "Goiânia",
          estado: "GO",
        },
      },
      usuarioId: null,
    });

    expect(eventoProdutoRepository.registrar)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          nome: "catalogo_local_visualizado",
          pagina: "catalogo_local",
          propriedades: {
            categoria: "Cílios",
            categoria_slug: "cilios",
            cidade: "Goiânia",
            estado: "GO",
          },
        })
      );
  });

  test("aceita evento de compartilhamento e origem própria do AF sem dados pessoais", async () => {
    await eventoProdutoService.registrar({
      corpo: {
        nome: "link_negocio_compartilhado",
        pagina: "perfil_negocio",
        missao: "descobrir_compartilhar_agendar",
        sessao_id: "sessao_share_123",
        negocio_id: 19,
        propriedades: {
          tipo_link: "negocio",
          metodo: "compartilhamento_nativo",
          af_source: "agenda_fashion",
          af_medium: "share",
          af_content: "negocio",
          email: "nao-salvar@example.com",
        },
      },
      usuarioId: null,
    });

    expect(eventoProdutoRepository.registrar).toHaveBeenCalledWith({
      nome: "link_negocio_compartilhado",
      pagina: "perfil_negocio",
      missao: "descobrir_compartilhar_agendar",
      sessaoId: "sessao_share_123",
      usuarioId: null,
      negocioId: 19,
      propriedades: {
        tipo_link: "negocio",
        metodo: "compartilhamento_nativo",
        af_source: "agenda_fashion",
        af_medium: "share",
        af_content: "negocio",
      },
    });
  });

  test("mantém limite específico para identificadores de clique", () => {
    expect(
      eventoProdutoService
        .LIMITES_PROPRIEDADES_TEXTO
        .gclid
    ).toBeGreaterThan(60);

    expect(
      eventoProdutoService
        .sanitizarPropriedades({
          gclid: "G".repeat(180),
        }).gclid
    ).toHaveLength(180);
  });

  test("preserva sinais Google modernos ao remover etiqueta antiga", () => {
    const propriedades = eventoProdutoService
      .sanitizarPropriedades({
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "aquisicao_profissionais",
        utm_content: "legado",
        gbraid: "gbraid-confirmado-123",
        landing_page: "/cadastro",
        referrer_host: "www.google.com",
      });

    expect(propriedades).toMatchObject({
      utm_source: "google",
      utm_medium: "cpc",
      gbraid: "gbraid-confirmado-123",
      landing_page: "/cadastro",
      referrer_host: "www.google.com",
    });
    expect(propriedades).not.toHaveProperty("utm_campaign");
    expect(propriedades).not.toHaveProperty("utm_content");
  });

  test("não confunde campanha antiga sem sinal Google com tráfego confirmado", () => {
    const propriedades = eventoProdutoService
      .sanitizarPropriedades({
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "search_aquisicao_profissionais",
      });

    expect(propriedades).not.toHaveProperty("utm_source");
    expect(propriedades).not.toHaveProperty("utm_medium");
    expect(propriedades).not.toHaveProperty("utm_campaign");
  });
});
