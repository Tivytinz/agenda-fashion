const crypto = require("crypto");
jest.mock("../src/repositories/adminAuditRepository", () => ({
  registrarEvento: jest.fn(), listar: jest.fn(), transacao: jest.fn(),
  buscarTentativaParaRevisao: jest.fn(), registrarRevisao: jest.fn()
}));

const repository = require("../src/repositories/adminAuditRepository");
const service = require("../src/services/adminAuditService");

beforeEach(() => {
  jest.clearAllMocks();
  repository.registrarEvento.mockResolvedValue({ id: 1 });
  repository.transacao.mockImplementation((callback) => callback({}));
});

test("revisão exige superadmin, tentativa vencida e evidência estruturada", async () => {
  const attemptId = "00000000-0000-4000-8000-000000000001";
  const payload = {
    admin: { usuarioId: 8, papel: "superadmin" }, tentativaId: attemptId,
    avaliacao: "INDETERMINADO", evidenciaTipo: "LOG_APLICACAO",
    evidenciaReferencia: "request-12345"
  };
  await expect(service.review({ ...payload, admin: { usuarioId: 8, papel: "admin" } }))
    .rejects.toMatchObject({ statusCode: 403 });
  await expect(service.review({ ...payload, evidenciaReferencia: "https://secret/token" }))
    .rejects.toMatchObject({ statusCode: 400 });
  await expect(service.review({ ...payload, avaliacao: "HTTP_OK" }))
    .rejects.toMatchObject({ statusCode: 400 });
  repository.buscarTentativaParaRevisao.mockResolvedValue({ id: 17, vencida: false });
  await expect(service.review(payload)).rejects.toMatchObject({ statusCode: 409 });
  repository.buscarTentativaParaRevisao.mockResolvedValue({ id: 17, vencida: true, resultado_id: 19 });
  await expect(service.review(payload)).rejects.toMatchObject({ statusCode: 409 });
  repository.buscarTentativaParaRevisao.mockResolvedValue({ id: 17, vencida: true });
  repository.registrarRevisao.mockResolvedValue({ revisado_em: "2026-09-25T00:00:00Z" });
  const result = await service.review(payload);
  expect(repository.registrarRevisao).toHaveBeenCalledWith(expect.objectContaining({
    tentativaId: attemptId, revisorUsuarioId: 8,
    evidenciaReferenciaHash: crypto.createHash("sha256").update("request-12345").digest("hex")
  }), expect.anything());
  expect(JSON.stringify(repository.registrarRevisao.mock.calls)).not.toContain("request-12345");
  expect(result.avaliacao).toBe("INDETERMINADO");
  repository.registrarRevisao.mockRejectedValueOnce({ code: "23505" });
  await expect(service.review(payload)).rejects.toMatchObject({ statusCode: 409 });
});

test("ação de revisão é auditada com UUID do alvo e não presume status HTTP", async () => {
  const id = "00000000-0000-4000-8000-000000000002";
  const started = await service.start({
    admin: { usuarioId: 8, papel: "superadmin" },
    action: "auditoria_revisar", targetAttemptId: id
  });
  expect(started).toMatchObject({ alvoTipo: "tentativa", alvoTentativaId: id });
  await expect(service.start({
    admin: { usuarioId: 8, papel: "superadmin" },
    action: "auditoria_revisar", targetAttemptId: "invalid"
  })).rejects.toMatchObject({ statusCode: 400 });
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

test("revisão humana não substitui resultado HTTP tardio na consulta", async () => {
  const row = {
    tentativa_id: "00000000-0000-4000-8000-000000000003",
    ator_usuario_id: "7", papel_admin: "admin", acao: "campanha_criar",
    alvo_tipo: "campanha", revisao_id: "19", revisor_usuario_id: "8",
    avaliacao: "INDETERMINADO", evidencia_tipo: "LOG_APLICACAO",
    evidencia_referencia_sha256: "a".repeat(64),
    revisado_em: "2026-09-24T12:20:00Z", vencida: true
  };
  repository.listar.mockResolvedValueOnce({ total: 1, rows: [row] });
  const reviewed = await service.list({
    admin: { usuarioId: 8, papel: "superadmin" }, query: { resultado: "REVISADA" }
  });
  expect(reviewed.eventos[0]).toMatchObject({
    resultado: "REVISADA", vencida: false,
    revisao: { revisorUsuarioId: 8, avaliacao: "INDETERMINADO" }
  });
  repository.listar.mockResolvedValueOnce({ total: 1, rows: [{
    ...row, resultado: "HTTP_OK", http_status: 201
  }] });
  const late = await service.list({ admin: { usuarioId: 8, papel: "superadmin" } });
  expect(late.eventos[0]).toMatchObject({
    resultado: "HTTP_OK", httpStatus: 201,
    revisao: { avaliacao: "INDETERMINADO" }
  });
});
