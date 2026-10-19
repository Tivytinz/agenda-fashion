jest.mock("../src/repositories/adminAuditRepository", () => ({ registrarEvento: jest.fn().mockResolvedValue({}) }));
const express = require(
  "express"
);
const request = require(
  "supertest"
);

jest.mock(
  "../src/middlewares/auth",
  () => (
    req,
    res,
    next
  ) => {
    req.user = {
      id: 7,
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
    };
    return next();
  }
);

jest.mock(
  "../src/services/contributionCostSyncService",
  () => ({
    status:
      jest.fn(),
    criarIntegracao:
      jest.fn(),
    atualizarIntegracao:
      jest.fn(),
    sincronizarManual:
      jest.fn(),
  })
);

const service = require(
  "../src/services/contributionCostSyncService"
);
const adminRoutes = require(
  "../src/routes/adminRoutes"
);

function criarApp() {
  const app = express();

  app.use(
    express.json()
  );
  app.use(
    adminRoutes
  );

  app.use(
    (
      erro,
      req,
      res,
      next
    ) =>
      res
        .status(
          erro?.statusCode ||
          500
        )
        .json({
          erro:
            erro.message,
        })
  );

  return app;
}

describe(
  "Wave 32 - rotas de sync de contribuição",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      service.status
        .mockResolvedValue({
          adaptadores: [],
          integracoes: [],
          execucoes: [],
        });
    });

    test(
      "status fica disponível para admin autenticado",
      async () => {
        const resposta =
          await request(
            criarApp()
          ).get(
            "/admin/financeiro/contribuicao/sync"
          );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          service.status
        ).toHaveBeenCalledTimes(1);
      }
    );

    test(
      "criação encaminha permissão administrativa resolvida no backend",
      async () => {
        service
          .criarIntegracao
          .mockResolvedValue({
            integracao: {
              id: 3,
            },
          });

        const payload = {
          fonteId: 9,
          adaptador:
            "provider_test",
          intervaloMinutos: 60,
          ativa: true,
          adminAutorizado: true,
        };

        const resposta =
          await request(
            criarApp()
          )
            .post(
              "/admin/financeiro/contribuicao/sync/integracoes"
            )
            .set(
              "x-test-admin",
              "yes"
            )
            .send(payload);

        expect(
          resposta.status
        ).toBe(201);

        expect(
          service
            .criarIntegracao
        ).toHaveBeenCalledWith({
          payload,
          adminAutorizado: true,
        });
      }
    );

    test(
      "pausa integração usando permissão atual do backend",
      async () => {
        service
          .atualizarIntegracao
          .mockResolvedValue({
            integracao: {
              id: 3,
              ativa: false,
            },
          });

        const payload = {
          ativa: false,
          intervaloMinutos: 60,
        };

        const resposta =
          await request(
            criarApp()
          )
            .patch(
              "/admin/financeiro/contribuicao/sync/integracoes/3"
            )
            .set(
              "x-test-admin",
              "yes"
            )
            .send(payload);

        expect(
          resposta.status
        ).toBe(200);

        expect(
          service
            .atualizarIntegracao
        ).toHaveBeenCalledWith({
          integracaoId: "3",
          payload,
          adminAutorizado: true,
        });
      }
    );

    test(
      "execução manual usa id da rota e permissão atual",
      async () => {
        service
          .sincronizarManual
          .mockResolvedValue({
            integracaoId: 3,
            status: "sucesso",
          });

        const resposta =
          await request(
            criarApp()
          )
            .post(
              "/admin/financeiro/contribuicao/sync/integracoes/3/executar"
            )
            .set(
              "x-test-admin",
              "yes"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          service
            .sincronizarManual
        ).toHaveBeenCalledWith({
          integracaoId: "3",
          adminAutorizado: true,
        });
      }
    );
  }
);
