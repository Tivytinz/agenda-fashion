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
      "registra cancelamento mesmo com contexto de negócio opcional",
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
                "agendamento_cancelado",
              pagina:
                "meus_agendamentos",
              missao:
                "acompanhar_agendamentos",
              sessao_id:
                "sessao_produto_123",
              negocio_id:
                14,
              propriedades: {
                agendamento_id:
                  32,
              },
            });

        expect(
          resposta.status
        ).toBe(
          202
        );

        expect(
          eventoProdutoRepository
            .registrar
        ).toHaveBeenCalledWith({
          nome:
            "agendamento_cancelado",
          pagina:
            "meus_agendamentos",
          missao:
            "acompanhar_agendamentos",
          sessaoId:
            "sessao_produto_123",
          usuarioId:
            null,
          negocioId:
            14,
          propriedades: {
            agendamento_id:
              32,
          },
        });
      }
    );

    test(
      "aceita a conclusão observacional da configuração da agenda",
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
                "agenda_configurada",
              pagina:
                "configuracao_agenda",
              missao:
                "disponibilizar_horarios",
              sessao_id:
                "sessao_agenda_123",
              propriedades: {
                status:
                  "sucesso",
              },
            });

        expect(
          resposta.status
        ).toBe(202);

        expect(
          eventoProdutoRepository
            .registrar
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            nome:
              "agenda_configurada",
            pagina:
              "configuracao_agenda",
            missao:
              "disponibilizar_horarios",
            usuarioId:
              7,
            propriedades: {
              status:
                "sucesso",
            },
          })
        );
      }
    );

    test(
      "aceita observabilidade da próxima ação sem persistir dados pessoais",
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
                "proxima_acao_ativacao_visualizada",
              pagina:
                "dashboard_dono",
              missao:
                "gerenciar_crescimento",
              sessao_id:
                "sessao_ativacao_123",
              negocio_id:
                11,
              propriedades: {
                estado_ativacao:
                  "CONFIRMAR_AGENDA",
                tipo_acao:
                  "NAVEGAR",
                telefone:
                  "62999999999",
                email:
                  "cliente@email.com",
              },
            });

        expect(
          resposta.status
        ).toBe(202);

        expect(
          eventoProdutoRepository
            .registrar
        ).toHaveBeenCalledWith({
          nome:
            "proxima_acao_ativacao_visualizada",
          pagina:
            "dashboard_dono",
          missao:
            "gerenciar_crescimento",
          sessaoId:
            "sessao_ativacao_123",
          usuarioId:
            7,
          negocioId:
            11,
          propriedades: {
            estado_ativacao:
              "CONFIRMAR_AGENDA",
            tipo_acao:
              "NAVEGAR",
          },
        });
      }
    );

    test(
      "aceita seleção observacional da próxima ação",
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
                "proxima_acao_ativacao_selecionada",
              pagina:
                "dashboard_dono",
              missao:
                "gerenciar_crescimento",
              sessao_id:
                "sessao_ativacao_456",
              propriedades: {
                estado_ativacao:
                  "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
                tipo_acao:
                  "COMPARTILHAR_PERFIL",
              },
            });

        expect(
          resposta.status
        ).toBe(202);
        expect(
          eventoProdutoRepository
            .registrar
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            nome:
              "proxima_acao_ativacao_selecionada",
            propriedades: {
              estado_ativacao:
                "CONQUISTAR_PRIMEIRO_AGENDAMENTO",
              tipo_acao:
                "COMPARTILHAR_PERFIL",
            },
          })
        );
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
