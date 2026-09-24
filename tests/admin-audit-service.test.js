const crypto = require("crypto");
jest.mock("../src/repositories/adminAuditRepository", () => ({
  registrarEvento: jest.fn(), listar: jest.fn()
}));

const repository = require("../src/repositories/adminAuditRepository");
const service = require("../src/services/adminAuditService");

beforeEach(() => {
  jest.clearAllMocks();
  repository.registrarEvento.mockResolvedValue({ id: 1 });
});

test("registra ator, ação e alvo com allowlist, sem payload ou segredo", async () => {
  const started = await service.start({
    admin: { usuarioId: 7, papel: "superadmin" },
    action: "campanha_atualizar",
    targetId: "12",
    requestId: "request-12345"
  });
  expect(repository.registrarEvento).toHaveBeenCalledWith(expect.objectContaining({
    fase: "INICIADA", acao: "campanha_atualizar", alvoTipo: "campanha",
    alvoId: 12, atorUsuarioId: 7,
    requestId: crypto.createHash("sha256").update("request-12345").digest("hex")
  }));
  expect(JSON.stringify(repository.registrarEvento.mock.calls)).not.toContain("senha");
  await service.finish(started, { status: 200 });
  expect(repository.registrarEvento).toHaveBeenLastCalledWith(expect.objectContaining({
    tentativaId: started.tentativaId,
    fase: "RESULTADO", resultado: "HTTP_OK", httpStatus: 200
  }));
});

test("não inicia ação administrativa sem ator ou auditoria disponível", async () => {
  await expect(service.start({
    admin: { usuarioId: 7, papel: "dono" }, action: "campanha_criar"
  })).rejects.toMatchObject({ statusCode: 403 });
  expect(repository.registrarEvento).not.toHaveBeenCalled();
  repository.registrarEvento.mockRejectedValueOnce(new Error("database down"));
  await expect(service.start({
    admin: { usuarioId: 7, papel: "admin" }, action: "campanha_criar"
  })).rejects.toThrow("database down");
});

test("consulta exige superadmin e limita filtros/paginação", async () => {
  repository.listar.mockResolvedValue({ total: 2, rows: [{
    tentativa_id: "attempt", ator_usuario_id: "7", papel_admin: "admin",
    acao: "campanha_criar", alvo_tipo: "campanha", alvo_id: "10",
    request_id: null, iniciado_em: "2026-09-24T00:00:00Z", resultado: null
  }] });
  await expect(service.list({ admin: { usuarioId: 7, papel: "admin" } }))
    .rejects.toMatchObject({ statusCode: 403 });
  const result = await service.list({
    admin: { usuarioId: 8, papel: "superadmin" },
    query: { acao: "campanha_criar", resultado: "PENDENTE", pagina: "1", limite: "1000" }
  });
  expect(repository.listar).toHaveBeenCalledWith(expect.objectContaining({
    acao: "campanha_criar", resultado: "PENDENTE", limite: 100, offset: 0
  }));
  expect(result.eventos[0]).toMatchObject({ resultado: "PENDENTE", alvoId: 10 });
  await expect(service.list({
    admin: { usuarioId: 8, papel: "superadmin" }, query: { acao: "desconhecida" }
  })).rejects.toMatchObject({ statusCode: 400 });
  await expect(service.list({
    admin: { usuarioId: 8, papel: "superadmin" }, query: { resultado: "CONCLUIDO" }
  })).rejects.toMatchObject({ statusCode: 400 });
});
