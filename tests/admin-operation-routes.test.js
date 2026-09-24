const express = require("express");
const request = require("supertest");

jest.mock(
  "../src/middlewares/auth",
  () => (
    req,
    res,
    next
  ) => {
    req.user = {
      id: 7
    };
    return next();
  }
);

jest.mock(
  "../src/middlewares/authAdmin",
  () => (
    req,
    res,
    next
  ) => {
    req.admin = {
      usuarioId: 7,
      papel: "admin",
      superadmin: false
    };
    return next();
  }
);

jest.mock(
  "../src/services/adminOperationService",
  () => ({
    listarUsuariosAdmin: jest.fn(),
    listarNegociosAdmin: jest.fn(),
    listarAgendamentosAdmin: jest.fn()
  })
);

const service = require(
  "../src/services/adminOperationService"
);
const adminRoutes = require(
  "../src/routes/adminRoutes"
);

function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(adminRoutes);
  app.use((erro, req, res, next) => res
    .status(erro?.statusCode || 500)
    .json({
      erro: erro.message
    })
  );
  return app;
}

describe("Admin Wave 1 - operação RF40", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("consulta usuários com filtros server-side", async () => {
    service.listarUsuariosAdmin.mockResolvedValue({
      usuarios: [],
      paginacao: {
        pagina: 2,
        limite: 25,
        total: 0,
        totalPaginas: 0
      }
    });

    const resposta = await request(criarApp())
      .get("/admin/usuarios")
      .query({
        busca: "ana@example.com",
        status: "ativo",
        pagina: "2",
        limite: "25"
      });

    expect(resposta.status).toBe(200);
    expect(service.listarUsuariosAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        busca: "ana@example.com",
        status: "ativo",
        pagina: "2",
        limite: "25"
      })
    );
  });

  test("mantém negócios e agendamentos no mesmo domínio operacional", async () => {
    service.listarNegociosAdmin.mockResolvedValue({
      negocios: [],
      paginacao: {}
    });
    service.listarAgendamentosAdmin.mockResolvedValue({
      agendamentos: [],
      paginacao: {}
    });

    const app = criarApp();

    const negocios = await request(app)
      .get("/admin/negocios")
      .query({ status: "arquivado" });

    const agendamentos = await request(app)
      .get("/admin/agendamentos")
      .query({ status: "falta" });

    expect(negocios.status).toBe(200);
    expect(agendamentos.status).toBe(200);
    expect(service.listarNegociosAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "arquivado"
      })
    );
    expect(service.listarAgendamentosAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "falta"
      })
    );
  });
});
