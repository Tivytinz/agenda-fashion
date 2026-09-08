const mockRepository = {
  criarEstado: jest.fn(),
  consumirEstado: jest.fn(),
  buscarCredencial: jest.fn(),
  salvarCredencial: jest.fn()
};

jest.mock(
  "../src/repositories/tiktokMarketingOAuthRepository",
  () => mockRepository
);

const service = require(
  "../src/services/tiktokMarketingOAuthService"
);

function envValido() {
  process.env.NODE_ENV = "test";
  process.env.PUBLIC_APP_URL = "https://app.agendafashion.com.br";
  process.env.TIKTOK_APP_ID = "app_123";
  process.env.TIKTOK_APP_SECRET = "secret_456";
  process.env.TIKTOK_ADVERTISER_ID = "777888999";
  process.env.TIKTOK_OAUTH_ENCRYPTION_KEY =
    "uma-chave-de-criptografia-com-mais-de-32-caracteres";
  process.env.TIKTOK_OAUTH_REDIRECT_URI =
    "https://app.agendafashion.com.br/admin/marketing/custos-integracoes/tiktok_ads/callback";
  process.env.TIKTOK_OAUTH_SCOPE = "4";
}

describe("tiktokMarketingOAuthService", () => {
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

  test("gera autorização oficial e persiste somente o hash do state", async () => {
    const resultado = await service.iniciarAutorizacao({ usuarioId: 9 });
    const url = new URL(resultado.authorizationUrl);
    const state = url.searchParams.get("state");

    expect(url.origin).toBe("https://ads.tiktok.com");
    expect(url.pathname).toBe("/marketing_api/auth");
    expect(url.searchParams.get("app_id")).toBe("app_123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      process.env.TIKTOK_OAUTH_REDIRECT_URI
    );
    expect(state).toBeTruthy();
    expect(mockRepository.criarEstado).toHaveBeenCalledWith(
      expect.objectContaining({
        stateHash: service.hashEstado(state),
        usuarioId: 9,
        expiresAt: expect.any(Date)
      })
    );
    expect(
      mockRepository.criarEstado.mock.calls[0][0].stateHash
    ).not.toBe(state);
  });

  test("troca auth_code por token longo, valida advertiser e salva apenas ciphertext", async () => {
    const state = "state-seguro-123";
    mockRepository.consumirEstado.mockResolvedValue({
      id: 1,
      usuario_id: 9,
      expires_at: new Date(Date.now() + 60000).toISOString()
    });
    mockRepository.salvarCredencial.mockImplementation(
      async (payload) => ({
        advertiser_id: payload.advertiserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 0,
        message: "OK",
        data: {
          access_token: "token-super-secreto",
          advertiser_ids: ["777888999", "111222333"],
          scope: [4]
        }
      })
    });

    const resultado = await service.concluirAutorizacao({
      state,
      authCode: "codigo-unico"
    });

    expect(resultado).toMatchObject({
      autorizado: true,
      advertiserId: "777888999"
    });
    expect(mockRepository.consumirEstado).toHaveBeenCalledWith({
      stateHash: service.hashEstado(state)
    });
    expect(global.fetch).toHaveBeenCalledWith(
      service.TOKEN_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json"
        })
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({
      app_id: "app_123",
      secret: "secret_456",
      auth_code: "codigo-unico"
    });
    const salvo = mockRepository.salvarCredencial.mock.calls[0][0];
    expect(salvo.accessTokenCiphertext).not.toContain("token-super-secreto");
    expect(service.descriptografar(salvo.accessTokenCiphertext))
      .toBe("token-super-secreto");
    expect(salvo.authorizedAdvertiserIds).toContain("777888999");
    expect(salvo.usuarioId).toBe(9);
  });

  test("recusa autorização sem acesso ao advertiser configurado", async () => {
    mockRepository.consumirEstado.mockResolvedValue({
      id: 1,
      usuario_id: 9,
      expires_at: new Date(Date.now() + 60000).toISOString()
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 0,
        message: "OK",
        data: {
          access_token: "token-de-outra-conta",
          advertiser_ids: ["123123123"],
          scope: [4]
        }
      })
    });

    await expect(
      service.concluirAutorizacao({
        state: "state-seguro",
        authCode: "auth-code"
      })
    ).rejects.toMatchObject({
      statusCode: 403
    });
    expect(mockRepository.salvarCredencial).not.toHaveBeenCalled();
  });

  test("não aceita redirect OAuth para origem ou rota diferente do AF", () => {
    process.env.TIKTOK_OAUTH_REDIRECT_URI =
      "https://evil.example/callback";

    expect(service.config()).toMatchObject({
      disponivel: false,
      redirectValido: false
    });
  });
});
