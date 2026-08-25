const mockRepository = {
  limparEstadosExpirados: jest.fn(),
  salvarEstado: jest.fn(),
  consumirEstado: jest.fn(),
  buscarCredencial: jest.fn(),
  salvarCredencial: jest.fn()
};

jest.mock(
  "../src/repositories/tiktokOAuthRepository",
  () => mockRepository
);

const service = require("../src/services/tiktokOAuthService");

const ENV_KEYS = [
  "PUBLIC_APP_URL",
  "TIKTOK_APP_ID",
  "TIKTOK_APP_SECRET",
  "TIKTOK_ADVERTISER_ID",
  "TIKTOK_OAUTH_ENCRYPTION_KEY",
  "TIKTOK_OAUTH_REDIRECT_URI",
  "TIKTOK_API_VERSION",
  "TIKTOK_ADS_ACCESS_TOKEN",
  "MARKETING_COST_SYNC_TIMEOUT_MS"
];

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
);
const originalFetch = global.fetch;

function response(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(payload)
  };
}

function configurar() {
  process.env.PUBLIC_APP_URL = "https://app.agendafashion.com.br";
  process.env.TIKTOK_APP_ID = "7673357738098360340";
  process.env.TIKTOK_APP_SECRET = "app-secret-private";
  process.env.TIKTOK_ADVERTISER_ID = "7673281927140098056";
  process.env.TIKTOK_OAUTH_ENCRYPTION_KEY =
    "oauth-encryption-key-with-more-than-32-characters";
  process.env.TIKTOK_OAUTH_REDIRECT_URI =
    "https://app.agendafashion.com.br/admin/trafego-pago/custos";
  process.env.TIKTOK_API_VERSION = "v1.3";
  process.env.MARKETING_COST_SYNC_TIMEOUT_MS = "10000";
  delete process.env.TIKTOK_ADS_ACCESS_TOKEN;
}

beforeEach(() => {
  jest.clearAllMocks();
  configurar();
  global.fetch = jest.fn();
  mockRepository.limparEstadosExpirados.mockResolvedValue();
  mockRepository.salvarEstado.mockResolvedValue();
  mockRepository.salvarCredencial.mockResolvedValue();
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  global.fetch = originalFetch;
});

test("inicia autorização com state aleatório e persiste somente o hash", async () => {
  const resultado = await service.iniciarAutorizacao({ usuarioId: 7 });
  const url = new URL(resultado.url);
  const state = url.searchParams.get("state");

  expect(url.origin).toBe("https://business-api.tiktok.com");
  expect(url.pathname).toBe("/portal/auth");
  expect(url.searchParams.get("app_id")).toBe("7673357738098360340");
  expect(url.searchParams.get("redirect_uri")).toBe(
    "https://app.agendafashion.com.br/admin/trafego-pago/custos"
  );
  expect(state).toBeTruthy();
  expect(state.length).toBeGreaterThan(30);

  expect(mockRepository.salvarEstado).toHaveBeenCalledWith(
    expect.objectContaining({
      stateHash: service.hashState(state),
      usuarioId: 7,
      redirectUri:
        "https://app.agendafashion.com.br/admin/trafego-pago/custos",
      expiresAt: expect.any(Date)
    })
  );
  expect(mockRepository.salvarEstado.mock.calls[0][0].stateHash).not.toBe(state);
});

test("troca auth_code, valida advertiser e salva tokens apenas criptografados", async () => {
  const state = "state-valid-and-single-use";
  mockRepository.consumirEstado.mockResolvedValue({
    usuario_id: 7,
    redirect_uri:
      "https://app.agendafashion.com.br/admin/trafego-pago/custos"
  });

  global.fetch
    .mockResolvedValueOnce(response({
      code: 0,
      message: "OK",
      data: {
        access_token: "access-token-plain",
        refresh_token: "refresh-token-plain",
        expires_in: 86400,
        refresh_token_expires_in: 31536000,
        scope: "ads.read",
        open_id: "open-id"
      }
    }))
    .mockResolvedValueOnce(response({
      code: 0,
      message: "OK",
      data: {
        list: [
          {
            advertiser_id: "7673281927140098056",
            advertiser_name: "Agenda Fashion TikTok"
          }
        ]
      }
    }));

  await expect(
    service.finalizarAutorizacao({
      authCode: "auth-code-single-use",
      state
    })
  ).resolves.toEqual({
    autorizado: true,
    advertiserId: "7673281927140098056"
  });

  expect(mockRepository.consumirEstado).toHaveBeenCalledWith(
    service.hashState(state)
  );

  const [tokenUrl, tokenOptions] = global.fetch.mock.calls[0];
  expect(tokenUrl).toBe(
    "https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/token/"
  );
  expect(tokenUrl).not.toContain("app-secret-private");
  expect(tokenUrl).not.toContain("auth-code-single-use");
  expect(JSON.parse(tokenOptions.body)).toEqual({
    client_id: "7673357738098360340",
    client_secret: "app-secret-private",
    grant_type: "authorization_code",
    auth_code: "auth-code-single-use",
    redirect_uri:
      "https://app.agendafashion.com.br/admin/trafego-pago/custos"
  });

  const [advertiserUrl, advertiserOptions] = global.fetch.mock.calls[1];
  expect(advertiserUrl).not.toContain("access-token-plain");
  expect(advertiserOptions.headers["Access-Token"]).toBe("access-token-plain");

  const saved = mockRepository.salvarCredencial.mock.calls[0][0];
  expect(saved.advertiserId).toBe("7673281927140098056");
  expect(saved.accessTokenEncrypted).not.toContain("access-token-plain");
  expect(saved.refreshTokenEncrypted).not.toContain("refresh-token-plain");
  expect(service.descriptografar(saved.accessTokenEncrypted)).toBe(
    "access-token-plain"
  );
  expect(service.descriptografar(saved.refreshTokenEncrypted)).toBe(
    "refresh-token-plain"
  );
});

test("recusa callback com state inválido antes de chamar TikTok", async () => {
  mockRepository.consumirEstado.mockResolvedValue(null);

  await expect(
    service.finalizarAutorizacao({
      authCode: "auth-code",
      state: "state-invalid"
    })
  ).rejects.toThrow("expirou ou já foi utilizada");

  expect(global.fetch).not.toHaveBeenCalled();
  expect(mockRepository.salvarCredencial).not.toHaveBeenCalled();
});

test("renova automaticamente access token expirando e rotaciona refresh token", async () => {
  const encryptedAccess = service.criptografar("old-access");
  const encryptedRefresh = service.criptografar("old-refresh");

  mockRepository.buscarCredencial.mockResolvedValue({
    advertiser_id: "7673281927140098056",
    access_token_encrypted: encryptedAccess,
    refresh_token_encrypted: encryptedRefresh,
    access_token_expires_at: new Date(Date.now() + 60 * 1000),
    refresh_token_expires_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    autorizado_por_usuario_id: 7
  });

  global.fetch
    .mockResolvedValueOnce(response({
      code: 0,
      message: "OK",
      data: {
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 86400,
        refresh_token_expires_in: 31536000
      }
    }))
    .mockResolvedValueOnce(response({
      code: 0,
      message: "OK",
      data: {
        list: [
          { advertiser_id: "7673281927140098056" }
        ]
      }
    }));

  await expect(service.obterAccessTokenValido()).resolves.toBe("new-access");

  const [refreshUrl, refreshOptions] = global.fetch.mock.calls[0];
  expect(refreshUrl).toBe(
    "https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/refresh_token/"
  );
  expect(refreshUrl).not.toContain("old-refresh");
  expect(JSON.parse(refreshOptions.body)).toMatchObject({
    refresh_token: "old-refresh",
    grant_type: "refresh_token",
    client_secret: "app-secret-private"
  });

  const saved = mockRepository.salvarCredencial.mock.calls[0][0];
  expect(service.descriptografar(saved.accessTokenEncrypted)).toBe("new-access");
  expect(service.descriptografar(saved.refreshTokenEncrypted)).toBe("new-refresh");
});

test("criptografia autenticada detecta credencial adulterada", () => {
  const encrypted = service.criptografar("segredo");
  const parts = encrypted.split(":");
  parts[3] = `${parts[3]}A`;

  expect(() => service.descriptografar(parts.join(":"))).toThrow(
    "Não foi possível abrir a credencial"
  );
});
