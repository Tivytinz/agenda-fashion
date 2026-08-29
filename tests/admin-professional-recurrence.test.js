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
    req.user = { id: 7 };
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
    if (
      req.headers[
        "x-test-admin"
      ] === "no"
    ) {
      return res
        .status(403)
        .json({
          erro:
            "Acesso restrito aos administradores da plataforma.",
        });
    }

    req.admin = {
      usuarioId: 7,
      papel: "admin",
    };
    return next();
  }
);

jest.mock(
  "../src/services/adminProfessionalRecurrenceService",
  () => ({
    buscarRecorrencia:
      jest.fn(),
  })
);

const service = require(
  "../src/services/adminProfessionalRecurrenceService"
);
const adminRoutes = require(
  "../src/routes/adminRoutes"
);

function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(adminRoutes);
  app.use(
    (
      erro,
      req,
      res,
      next
    ) => res
      .status(
        erro?.statusCode || 500
      )
      .json({
        erro: erro.message,
      })
  );
  return app;
}

describe(
  "rota de recorrencia profissional",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "exige administrador",
      async () => {
        const resposta =
          await request(criarApp())
            .get(
              "/admin/marketing/recorrencia-profissionais"
            )
            .set(
              "x-test-admin",
              "no"
            );

        expect(resposta.status)
          .toBe(403);
        expect(
          service.buscarRecorrencia
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "encaminha o periodo e retorna a recorrencia observada",
      async () => {
        service.buscarRecorrencia
          .mockResolvedValue({
            periodo: "7",
            resumo: {
              comPrimeiroAgendamento: 4,
              comSegundoAgendamento: 3,
              comTerceiroAgendamento: 2,
            },
          });

        const resposta =
          await request(criarApp())
            .get(
              "/admin/marketing/recorrencia-profissionais?periodo=7"
            );

        expect(resposta.status)
          .toBe(200);
        expect(
          service.buscarRecorrencia
        ).toHaveBeenCalledWith({
          periodo: "7",
        });
        expect(
          resposta.body.resumo
            .comTerceiroAgendamento
        ).toBe(2);
      }
    );
  }
);
