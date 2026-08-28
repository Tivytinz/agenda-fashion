const express = require("express");
const request = require("supertest");

jest.mock("../src/middlewares/auth", () => (
  req,
  res,
  next
) => {
  if (req.headers["x-test-auth"] === "no") {
    return res.status(401).json({ erro: "Usuário não autenticado." });
  }
  req.user = { id: 7 };
  return next();
});

jest.mock("../src/middlewares/authAdmin", () => (
  req,
  res,
  next
) => {
  if (req.headers["x-test-admin"] === "no") {
    return res.status(403).json({ erro: "Acesso restrito." });
  }
  req.admin = { usuarioId: 7, papel: "admin" };
  return next();
});

jest.mock("../src/services/googleAnalyticsReportingService", () => ({
  buscarPainel: jest.fn()
}));

const service = require(
  "../src/services/googleAnalyticsReportingService"
);
const adminRoutes = require("../src/routes/adminRoutes");

function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(adminRoutes);
  app.use((erro, _req, res, _next) =>
    res.status(erro?.statusCode || 500).json({ erro: erro.message })
  );
  return app;
}

describe("relatório administrativo do GA4", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service.buscarPainel.mockResolvedValue({
      configurado: true,
      resumo: { sessoes: 12 }
    });
  });

  test("exige autenticação", async () => {
    const response = await request(criarApp())
      .get("/admin/marketing/ga4?periodo=30")
      .set("x-test-auth", "no");

    expect(response.status).toBe(401);
    expect(service.buscarPainel).not.toHaveBeenCalled();
  });

  test("exige administrador", async () => {
    const response = await request(criarApp())
      .get("/admin/marketing/ga4?periodo=30")
      .set("x-test-admin", "no");

    expect(response.status).toBe(403);
    expect(service.buscarPainel).not.toHaveBeenCalled();
  });

  test("encaminha o período ao serviço", async () => {
    const response = await request(criarApp())
      .get("/admin/marketing/ga4?periodo=7");

    expect(response.status).toBe(200);
    expect(service.buscarPainel).toHaveBeenCalledWith({
      periodo: "7"
    });
    expect(response.body.resumo.sessoes).toBe(12);
  });
});
