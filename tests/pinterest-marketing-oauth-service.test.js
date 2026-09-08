const mockRepository = {
  criarEstado: jest.fn(),
  consumirEstado: jest.fn(),
  buscarCredencial: jest.fn(),
  salvarCredencial: jest.fn(),
  atualizarTokens: jest.fn()
};

jest.mock(
  "../src/repositories/pinterestMarketingOAuthRepository",
  () => mockRepository
);

const service = require(
  "../src/services/pinterestMarketingOAuthService"
);

function envValido() {
  process.env.NODE_ENV = "test";
  process.env.PUBLIC_APP_URL = "https://app.agendafashion.com.br";
  process.env.PINTEREST_APP_ID = "123456";
  process.env.PINTEREST_APP_SECRET = "secret-pinterest";
  process.env.PINTEREST_AD_ACCOUNT_ID = "777888999";
  process.env.PINTEREST_OAUTH_ENCRYPTION_KEY =
    "uma-chave-pinterest-com-mais-de-32-caracteres";
  process.env.PINTEREST_OAUTH_REDIRECT_URI =
    "https://app.agendafashion.com.br/admin/marketing/custos-integracoes/pinterest_ads/callback";
  process.env.PINTEREST_OAUTH_SCOPE = "ads:read";
}

function tokenPayload(overrides = {}) {
  return {
    access_token: "pina_access_super_secreto",
    refresh_token: "pinr_refresh_super_secreto",
    expires_in: 2592000,
    refresh_token_expires_in: 5184000,
    scope: "ads:read",
    ...overrides
  };
}

describe("pinterestMarketingOAuthService", () => {
  const envOriginal = process.env;
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envOriginal };
    envValido();
    mockRepository.buscarCredencial.mockResolvedValue(null);
    mockRepository.criarEstado.mockResolvedValue({ id: 1 });
  });

  afterEach(() => {
    process.env = envOriginal;
    global.fetch = fetchOriginal;
  });

  test("gera OAuth oficial com escopo mínimo e persiste somente o hash do state", async () => {
    const resultado = await service.iniciarAutorizacao({ usuarioId: 9 });
    const url = new URL(resultado.authorizationUrl);
    const state = url.searchParams.get("state");

    expect(url.origin).toBe("https://www.pinterest.com");
    expect(url.pathname).toBe("/oauth/");
    expect(url.searchParams.get("client_id")).toBe("123456");
    expect(url.searchParams.get("redirect_uri")).toBe(
      process.env.PINTEREST_OAUTH_REDIRECT_URI
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("ads:read");
    expect(state).toBeTruthy();
    expect(mockRepository.criarEstado).toHaveBeenCalledWith(
      expect.objectContaining({
        stateHash: service.hashEstado(state),
        usuarioId: 9,
        expiresAt: expect.any(Date)
      })
    );
    expect(mockRepository.criarEstado.mock.calls[0][0].stateHash)
      .not.toBe(state);
  });

  test("troca code por tokens, valida ad account e salva somente ciphertext", async () => {
    mockRepository.consumirEstado.mockResolvedValue({
      id: 1,
      usuario_id: 9,
      expires_at: new Date(Date.now() + 60000).toISOString()
    });
    mockRepository.salvarCredencial.mockImplementation(async (payload) => ({
      ad_account_id: payload.adAccountId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => tokenPayload()
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: "777888999",
          name: "Agenda Fashion",
          currency: "BRL"
        })
      });

    const resultado = await service.concluirAutorizacao({
      state: "state-seguro",
      code: "codigo-pinterest"
    });

    expect(resultado).toMatchObject({
      autorizado: true,
      adAccountId: "777888999"
    });
    const tokenCall = global.fetch.mock.calls[0];
    expect(tokenCall[0]).toBe(service.TOKEN_URL);
    expect(tokenCall[1].headers.Authorization).toMatch(/^Basic /);
    expect(tokenCall[1].headers["Content-Type"])
      .toBe("application/x-www-form-urlencoded");
    expect(tokenCall[1].body).toContain("grant_type=authorization_code");
    expect(tokenCall[1].body).toContain("code=codigo-pinterest");

    const salvo = mockRepository.salvarCredencial.mock.calls[0][0];
    expect(salvo.accessTokenCiphertext).not.toContain("pina_access_super_secreto");
    expect(salvo.refreshTokenCiphertext).not.toContain("pinr_refresh_super_secreto");
    expect(service.descriptografar(salvo.accessTokenCiphertext))
      .toBe("pina_access_super_secreto");
    expect(service.descriptografar(salvo.refreshTokenCiphertext))
      .toBe("pinr_refresh_super_secreto");
    expect(salvo.scope).toEqual(["ads:read"]);
    expect(salvo.usuarioId).toBe(9);
  });

  test("renova access token antes de expirar e persiste refresh token rotacionado", async () => {
    const accessCipher = service.criptografar("pina_antigo");
    const refreshCipher = service.criptografar("pinr_antigo");
    mockRepository.buscarCredencial.mockResolvedValue({
      ad_account_id: "777888999",
      access_token_ciphertext: accessCipher,
      refresh_token_ciphertext: refreshCipher,
      scope: ["ads:read"],
      access_token_expires_at: new Date(Date.now() + 1000).toISOString(),
      refresh_token_expires_at: new Date(Date.now() + 86400000).toISOString()
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => tokenPayload({
        access_token: "pina_novo",
        refresh_token: "pinr_novo"
      })
    });
    mockRepository.atualizarTokens.mockResolvedValue({ id: 1 });

    await expect(service.obterAccessToken()).resolves.toBe("pina_novo");
    const salvo = mockRepository.atualizarTokens.mock.calls[0][0];
    expect(service.descriptografar(salvo.accessTokenCiphertext)).toBe("pina_novo");
    expect(service.descriptografar(salvo.refreshTokenCiphertext)).toBe("pinr_novo");
  });

  test("recusa escopo maior que ads:read e redirect fora do AF", () => {
    process.env.PINTEREST_OAUTH_SCOPE = "ads:read,ads:write";
    expect(service.config()).toMatchObject({
      disponivel: false,
      scopeValido: false
    });

    process.env.PINTEREST_OAUTH_SCOPE = "ads:read";
    process.env.PINTEREST_OAUTH_REDIRECT_URI = "https://evil.example/callback";
    expect(service.config()).toMatchObject({
      disponivel: false,
      redirectValido: false
    });
  });
});
