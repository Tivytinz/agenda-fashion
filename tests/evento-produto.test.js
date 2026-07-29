const express = require(
  "express"
);

const request = require(
  "supertest"
);

jest.mock(
  "../src/middlewares/optionalAuth",
  () => (
    req,
    res,
    next
  ) => {
    if (
      req.headers[
        "x-test-user"
      ]
    ) {
      req.user = {
        id:
          Number(
            req.headers[
              "x-test-user"
            ]
          ),
      };
    }

    return next();
  }
);

jest.mock(
  "../src/repositories/eventoProdutoRepository",
  () => ({
    registrar:
      jest.fn(),
  })
);

const eventoProdutoRepository =
  require(
    "../src/repositories/eventoProdutoRepository"
  );

const eventoProdutoRoutes =
  require(
    "../src/routes/eventoProdutoRoutes"
  );

function criarApp() {
  const app =
    express();

  app.use(
    express.json()
  );

  app.use(
    eventoProdutoRoutes
  );

  app.use(
    (
      erro,
      req,
      res,
      next
    ) => {
      return res
        .status(
          erro.statusCode ||
          500
        )
        .json({
          erro:
            erro.message,
        });
    }
  );

  return app;
}

describe(
  "eventos de comportamento do produto",
  () => {
    beforeEach(
      () => {
        jest
          .clearAllMocks();

        eventoProdutoRepository
          .registrar
          .mockResolvedValue({
            id:
              91,
          });
      }
    );

    test(
      "registra evento com contexto mínimo e sem dados pessoais",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .post(
              "/eventos-produto"
            )
            .set(
              "x-test-user",
              "7"
            )
            .send({
              nome:
                "mensagem_crescimento_visualizada",
              pagina:
                "dashboard_dono",
              missao:
                "acompanhar_crescimento",
              sessao_id:
                "sessao_produto_123",
              negocio_id:
                11,
              propriedades: {
                faixa:
                  "crescendo",
                agendamentos_mes:
                  24,
                telefone:
                  "62999999999",
                email:
                  "cliente@email.com",
              },
            });

        expect(
          resposta.status
        ).toBe(
          202
        );

        expect(
          resposta.body
        ).toEqual({
          recebido:
            true,
          id:
            91,
        });

        expect(
          eventoProdutoRepository
            .registrar
        ).toHaveBeenCalledWith({
          nome:
            "mensagem_crescimento_visualizada",
          pagina:
            "dashboard_dono",
          missao:
            "acompanhar_crescimento",
          sessaoId:
            "sessao_produto_123",
          usuarioId:
            7,
          negocioId:
            11,
          propriedades: {
            faixa:
              "crescendo",
            agendamentos_mes:
              24,
          },
        });
      }
    );

    test(
      "rejeita nomes de evento fora do contrato",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .post(
              "/eventos-produto"
            )
            .send({
              nome:
                "evento_inventado",
              pagina:
                "inicio",
              missao:
                "descobrir_servico",
              sessao_id:
                "sessao_produto_123",
            });

        expect(
          resposta.status
        ).toBe(
          400
        );

        expect(
          eventoProdutoRepository
            .registrar
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);
