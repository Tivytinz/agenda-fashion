const mockSyncService = {};
const mockOAuthService = {
  iniciarAutorizacao: jest.fn(),
  finalizarAutorizacao: jest.fn()
};
const mockRegistrador = {
  aviso: jest.fn()
};

jest.mock(
  "../src/services/marketingCostSyncService",
  () => mockSyncService
);

jest.mock(
  "../src/services/tiktokOAuthService",
  () => mockOAuthService
);

jest.mock(
  "../src/utils/registrador",
  () => mockRegistrador
);

const controller = require(
  "../src/controllers/marketingCostSyncController"
);

function resposta() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis()
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("rota de custos normal segue para a SPA quando não há callback TikTok", async () => {
  const req = { query: { periodo: "30" } };
  const res = resposta();
  const next = jest.fn();

  await controller.callbackTikTok(req, res, next);

  expect(next).toHaveBeenCalledTimes(1);
  expect(mockOAuthService.finalizarAutorizacao).not.toHaveBeenCalled();
  expect(res.redirect).not.toHaveBeenCalled();
});

test("query state isolada não é tratada como callback OAuth", async () => {
  const req = { query: { state: "filtro-da-pagina" } };
  const res = resposta();
  const next = jest.fn();

  await controller.callbackTikTok(req, res, next);

  expect(next).toHaveBeenCalledTimes(1);
  expect(mockOAuthService.finalizarAutorizacao).not.toHaveBeenCalled();
});

test("callback válido conclui OAuth e remove auth_code da URL final", async () => {
  mockOAuthService.finalizarAutorizacao.mockResolvedValue({ autorizado: true });
  const req = {
    query: {
      auth_code: "codigo-secreto-de-uso-unico",
      state: "state-seguro"
    }
  };
  const res = resposta();
  const next = jest.fn();

  await controller.callbackTikTok(req, res, next);

  expect(mockOAuthService.finalizarAutorizacao).toHaveBeenCalledWith({
    authCode: "codigo-secreto-de-uso-unico",
    state: "state-seguro"
  });
  expect(res.redirect).toHaveBeenCalledWith(
    303,
    "/admin/trafego-pago/custos?tiktok_oauth=success"
  );
  expect(res.redirect.mock.calls[0][1]).not.toContain("codigo-secreto");
  expect(res.redirect.mock.calls[0][1]).not.toContain("state-seguro");
});

test("falha de callback retorna marcador genérico e não registra auth_code", async () => {
  mockOAuthService.finalizarAutorizacao.mockRejectedValue(
    Object.assign(new Error("falha com token sensível"), { statusCode: 502 })
  );
  const req = {
    query: {
      auth_code: "auth-code-privado",
      state: "state-privado"
    }
  };
  const res = resposta();

  await controller.callbackTikTok(req, res, jest.fn());

  expect(res.redirect).toHaveBeenCalledWith(
    303,
    "/admin/trafego-pago/custos?tiktok_oauth=error"
  );
  const log = JSON.stringify(mockRegistrador.aviso.mock.calls);
  expect(log).not.toContain("auth-code-privado");
  expect(log).not.toContain("state-privado");
  expect(log).not.toContain("token sensível");
});
