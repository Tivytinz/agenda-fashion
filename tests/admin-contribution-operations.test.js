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
      papel:
        req.headers[
          "x-test-superadmin"
        ] === "yes"
          ? "superadmin"
          : "admin",
      superadmin:
        req.headers[
          "x-test-superadmin"
        ] === "yes",
    };

    return next();
  }
);

jest.mock(
  "../src/services/adminContributionOperationsService",
  () => ({
    buscarPainel:
      jest.fn(),
    criarFonte:
      jest.fn(),
    registrarCusto:
      jest.fn(),
    registrarCobertura:
      jest.fn(),
  })
);

const service = require(
  "../src/services/adminContributionOperationsService"
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
  "Wave 31 - rotas administrativas de contribuição",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "leitura informa se o administrador pode editar",
      async () => {
        service.buscarPainel
          .mockResolvedValue({
            podeEditar: false,
            fontes: [],
            custos: [],
            operacoes: [],
          });

        const resposta =
          await request(
            criarApp()
          )
            .get(
              "/admin/financeiro/contribuicao"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          service.buscarPainel
        ).toHaveBeenCalledWith({
          superadmin: false,
        });
      }
    );

    test(
      "criação de fonte encaminha ator e permissão do backend",
      async () => {
        service.criarFonte
          .mockResolvedValue({
            fonte: {
              id: 1,
            },
          });

        const payload = {
          codigo:
            "mensageria_variavel",
          nome:
            "Mensageria variável",
          categoria:
            "comunicacao",
          motivo:
            "Contrato confirmado",
        };

        const resposta =
          await request(
            criarApp()
          )
            .post(
              "/admin/financeiro/contribuicao/fontes"
            )
            .set(
              "x-test-superadmin",
              "yes"
            )
            .send(payload);

        expect(
          resposta.status
        ).toBe(201);

        expect(
          service.criarFonte
        ).toHaveBeenCalledWith({
          payload,
          usuarioId: 7,
          superadmin: true,
        });
      }
    );

    test(
      "registro de custo nunca recebe ator vindo do payload",
      async () => {
        service.registrarCusto
          .mockResolvedValue({
            custo: {
              id: 2,
            },
          });

        const payload = {
          fonteCodigo:
            "mensageria_variavel",
          negocioId: 8,
          tipo: "DEBITO",
          valor: 10,
          chaveOrigem:
            "evt_2",
          ocorridoEm:
            "2026-09-23T20:00:00Z",
          usuarioId: 999,
          motivo:
            "Fechamento factual",
        };

        const resposta =
          await request(
            criarApp()
          )
            .post(
              "/admin/financeiro/contribuicao/custos"
            )
            .set(
              "x-test-superadmin",
              "yes"
            )
            .send(payload);

        expect(
          resposta.status
        ).toBe(201);

        expect(
          service.registrarCusto
        ).toHaveBeenCalledWith({
          payload,
          usuarioId: 7,
          superadmin: true,
        });
      }
    );

    test(
      "cobertura usa somente identidade administrativa autenticada",
      async () => {
        service.registrarCobertura
          .mockResolvedValue({
            cobertura: {
              fonteId: 1,
            },
          });

        const payload = {
          fonteCodigo:
            "mensageria_variavel",
          inicioCobertura:
            "2026-09-01",
          cobertoAte:
            "2026-09-23",
          status:
            "COMPLETA",
          motivo:
            "Conciliação concluída",
        };

        const resposta =
          await request(
            criarApp()
          )
            .post(
              "/admin/financeiro/contribuicao/cobertura"
            )
            .set(
              "x-test-superadmin",
              "yes"
            )
            .send(payload);

        expect(
          resposta.status
        ).toBe(200);

        expect(
          service.registrarCobertura
        ).toHaveBeenCalledWith({
          payload,
          usuarioId: 7,
          superadmin: true,
        });
      }
    );
  }
);
