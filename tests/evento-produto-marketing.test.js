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
    await eventoProdutoService.registrar({
      corpo: {
        nome: "agendamento_concluido",
        pagina: "finalizar_agendamento",
        missao: "confirmar_agendamento",
        sessao_id: "sessao_marketing_123",
        negocio_id: 19,
        propriedades: {
          utm_source: "facebook",
          utm_medium: "cpc",
          utm_campaign: "goiania_cilios_agosto",
          utm_content: "video_01",
          utm_term: "lash_designer",
          gclid: "google-click-id",
          fbclid: "meta-click-id",
          landing_page: "/negocio/studio-bella",
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
        utm_source: "facebook",
        utm_medium: "cpc",
        utm_campaign: "goiania_cilios_agosto",
        utm_content: "video_01",
        utm_term: "lash_designer",
        gclid: "google-click-id",
        fbclid: "meta-click-id",
        landing_page: "/negocio/studio-bella",
      },
    });
  });

  test("aceita visualização da landing profissional com atribuição", async () => {
    await eventoProdutoService.registrar({
      corpo: {
        nome: "landing_profissionais_visualizada",
        pagina: "para_profissionais",
        missao: "adquirir_profissional",
        sessao_id: "sessao_landing_prof_123",
        propriedades: {
          utm_source: "google",
          utm_medium: "cpc",
          utm_campaign: "agenda_profissionais",
          gclid: "gclid-123",
          email: "nao-deve-persistir@example.com",
        },
      },
      usuarioId: null,
    });

    expect(eventoProdutoRepository.registrar).toHaveBeenCalledWith({
      nome: "landing_profissionais_visualizada",
      pagina: "para_profissionais",
      missao: "adquirir_profissional",
      sessaoId: "sessao_landing_prof_123",
      usuarioId: null,
      negocioId: null,
      propriedades: {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "agenda_profissionais",
        gclid: "gclid-123",
      },
    });
  });

  test("aceita clique no CTA e preserva somente a posição permitida", async () => {
    await eventoProdutoService.registrar({
      corpo: {
        nome: "landing_profissionais_cta_clicado",
        pagina: "para_profissionais",
        missao: "adquirir_profissional",
        sessao_id: "sessao_cta_prof_1234",
        propriedades: {
          posicao: "hero",
          segredo: "nao-deve-persistir",
        },
      },
      usuarioId: null,
    });

    expect(eventoProdutoRepository.registrar).toHaveBeenCalledWith({
      nome: "landing_profissionais_cta_clicado",
      pagina: "para_profissionais",
      missao: "adquirir_profissional",
      sessaoId: "sessao_cta_prof_1234",
      usuarioId: null,
      negocioId: null,
      propriedades: {
        posicao: "hero",
      },
    });
  });

  test("mantém reservado o evento de início do cadastro profissional", () => {
    expect(
      eventoProdutoService.EVENTOS_PERMITIDOS.has(
        "cadastro_profissional_iniciado"
      )
    ).toBe(true);
  });
});
