const express = require("express");
const request = require("supertest");

jest.mock("../src/services/adminAuditService", () => ({
  ACTIONS: new Map([["campanha_criar", "campanha"]]),
  start: jest.fn(), finish: jest.fn(), list: jest.fn()
}));

const audit = require("../src/services/adminAuditService");
const middleware = require("../src/middlewares/adminAudit");
const controller = require("../src/controllers/adminAuditController");

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, res, next) => {
    req.admin = { usuarioId: 7, papel: req.headers["x-role"] || "superadmin" };
    req.id = "request-12345";
    next();
  });
  instance.post("/write", middleware("campanha_criar"), (req, res) =>
    res.status(201).json({ campanha: { id: 42 }, senha: "never audit this" })
  );
  instance.get("/admin/auditoria", controller.list);
  instance.use((error, req, res, next) => res.status(error.statusCode || 500).json({ error: error.message }));
  return instance;
}

beforeEach(() => {
  jest.clearAllMocks();
  audit.start.mockResolvedValue({
    tentativaId: "00000000-0000-4000-8000-000000000001",
    acao: "campanha_criar", alvoTipo: "campanha", alvoId: null
  });
  audit.finish.mockResolvedValue({});
});

test("bloqueia escrita quando a auditoria não inicia", async () => {
  audit.start.mockRejectedValueOnce(new Error("db down"));
  const result = await request(app()).post("/write");
  expect(result.status).toBe(503);
  expect(audit.finish).not.toHaveBeenCalled();
});

test("registra alvo confirmado e HTTP sem gravar payload", async () => {
  const result = await request(app()).post("/write").send({ token: "sensitive" });
  expect(result.status).toBe(201);
  await new Promise((resolve) => setImmediate(resolve));
  expect(audit.start).toHaveBeenCalledWith({
    admin: { usuarioId: 7, papel: "superadmin" },
    action: "campanha_criar", targetId: undefined,
    targetCode: undefined, requestId: "request-12345"
  });
  expect(audit.finish).toHaveBeenCalledWith(expect.anything(), { targetId: 42, status: 201 });
  expect(JSON.stringify(audit.start.mock.calls)).not.toContain("sensitive");
  expect(JSON.stringify(audit.finish.mock.calls)).not.toContain("senha");
});

test("consulta a auditoria pelo service, que valida superadmin", async () => {
  audit.list.mockResolvedValueOnce({ eventos: [], paginacao: {} });
  const result = await request(app()).get("/admin/auditoria");
  expect(result.status).toBe(200);
  expect(audit.list).toHaveBeenCalledWith(expect.objectContaining({
    admin: { usuarioId: 7, papel: "superadmin" }
  }));
});
