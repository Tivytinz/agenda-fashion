const express = require(
  "express"
);

const request = require(
  "supertest"
);

/*
 * Simula o middleware de autenticação.
 *
 * Por padrão, a requisição está autenticada.
 * O header x-test-auth=no simula token ausente
 * ou inválido.
 */
jest.mock(
  "../src/middlewares/auth",
  () => {
    return (
      req,
      res,
      next
    ) => {
      if (
        req.headers[
          "x-test-auth"
        ] === "no"
      ) {
        return res
          .status(401)
          .json({
            erro:
              "Usuário não autenticado.",
          });
      }

      req.user = {
        id: 7,
      };

      return next();
    };
  }
);

/*
 * Simula a consulta à tabela
 * usuarios_administradores.
 *
 * Por padrão, o usuário é administrador.
 * O header x-test-admin=no simula um usuário
 * comum tentando acessar o painel.
 */
jest.mock(
  "../src/middlewares/authAdmin",
  () => {
    return (
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
        usuarioId:
          Number(
            req.user?.id
          ),

        papel:
          "admin",

        superadmin:
          false,
      };

      return next();
    };
  }
);

jest.mock(
  "../src/services/adminService",
  () => ({
    buscarDashboardAdmin:
      jest.fn(),

    buscarMarketingAdmin:
      jest.fn(),
  })
);

jest.mock(
  "../src/services/adminOperationService",
  () => ({
    listarNegociosAdmin:
      jest.fn(),

    listarAgendamentosAdmin:
      jest.fn(),
  })
);

const adminService = require(
  "../src/services/adminService"
);

const adminOperationService = require(
  "../src/services/adminOperationService"
);

const adminRoutes = require(
  "../src/routes/adminRoutes"
);

function criarApp() {
  const app =
    express();

  app.use(
    express.json()
  );

  app.use(
    adminRoutes
  );

  /*
   * Middleware central simplificado
   * para os testes.
   */
  app.use(
    (
      erro,
      req,
      res,
      next
    ) => {
      const status =
        Number(
          erro?.statusCode ||
          erro?.status
        ) || 500;

      return res
        .status(status)
        .json({
          erro:
            status === 500
              ? "Erro interno do servidor."
              : erro.message,
        });
    }
  );

  return app;
}

describe(
  "Rotas administrativas",
  () => {
    let app;

    beforeEach(() => {
      jest.clearAllMocks();

      app =
        criarApp();
    });

    test(
      "retorna 401 quando o usuário não está autenticado",
      async () => {
        const resposta =
          await request(app)
            .get(
              "/admin/dashboard"
            )
            .set(
              "x-test-auth",
              "no"
            );

        expect(
          resposta.status
        ).toBe(401);

        expect(
          resposta.body
        ).toEqual({
          erro:
            "Usuário não autenticado.",
        });

        expect(
          adminService
            .buscarDashboardAdmin
        ).not.toHaveBeenCalled();

        expect(
          adminOperationService
            .listarNegociosAdmin
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 403 quando o usuário não é administrador",
      async () => {
        const resposta =
          await request(app)
            .get(
              "/admin/dashboard"
            )
            .set(
              "x-test-admin",
              "no"
            );

        expect(
          resposta.status
        ).toBe(403);

        expect(
          resposta.body
        ).toEqual({
          erro:
            "Acesso restrito aos administradores da plataforma.",
        });

        expect(
          adminService
            .buscarDashboardAdmin
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna o dashboard administrativo e encaminha o período",
      async () => {
        adminService
          .buscarDashboardAdmin
          .mockResolvedValue({
            periodo:
              "7",

            totalNegocios:
              12,

            totalClientes:
              40,

            totalProfissionais:
              18,

            totalAgendamentos:
              75,

            indicadores: {
              totalNegocios:
                12,

              totalClientes:
                40,

              totalProfissionais:
                18,

              totalAgendamentos:
                75,
            },
          });

        const resposta =
          await request(app)
            .get(
              "/admin/dashboard?periodo=7"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          resposta.headers[
            "cache-control"
          ]
        ).toBe(
          "no-store, no-cache, must-revalidate"
        );

        expect(
          resposta.headers.pragma
        ).toBe("no-cache");

        expect(
          adminService
            .buscarDashboardAdmin
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          adminService
            .buscarDashboardAdmin
        ).toHaveBeenCalledWith({
          periodo:
            "7",
        });

        expect(
          resposta.body
        ).toMatchObject({
          periodo:
            "7",

          totalNegocios:
            12,

          totalClientes:
            40,

          totalProfissionais:
            18,

          totalAgendamentos:
            75,
        });
      }
    );

    test(
      "encaminha período indefinido quando a query não é enviada",
      async () => {
        adminService
          .buscarDashboardAdmin
          .mockResolvedValue({
            periodo:
              "all",

            totalNegocios:
              0,

            totalClientes:
              0,

            totalProfissionais:
              0,

            totalAgendamentos:
              0,
          });

        const resposta =
          await request(app)
            .get(
              "/admin/dashboard"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          adminService
            .buscarDashboardAdmin
        ).toHaveBeenCalledWith({
          periodo:
            undefined,
        });

        expect(
          resposta.body.periodo
        ).toBe(
          "all"
        );
      }
    );

    test(
      "lista os negócios administrativos e encaminha a paginação",
      async () => {
        adminOperationService
          .listarNegociosAdmin
          .mockResolvedValue({
            negocios: [
              {
                id:
                  11,

                nome:
                  "Studio Victor",

                slug:
                  "studio-victor",

                cidade:
                  "Goiânia",

                whatsapp:
                  "62999999999",

                ativo:
                  true,

                total_profissionais:
                  2,

                total_servicos:
                  5,

                total_agendamentos:
                  20,
              },
            ],
            paginacao: {
              pagina: 2,
              limite: 25,
              total: 30,
              totalPaginas: 2,
            },
          });

        const resposta =
          await request(app)
            .get(
              "/admin/negocios?busca=Victor&pagina=2&limite=25"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          adminOperationService
            .listarNegociosAdmin
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          adminOperationService
            .listarNegociosAdmin
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            busca: "Victor",
            pagina: "2",
            limite: "25",
          })
        );

        expect(
          resposta.body.negocios
        ).toHaveLength(1);

        expect(
          resposta.body.negocios[0]
        ).toMatchObject({
          id:
            11,

          nome:
            "Studio Victor",

          whatsapp:
            "62999999999",

          ativo:
            true,
        });

        expect(
          resposta.body.paginacao
        ).toMatchObject({
          pagina: 2,
          total: 30,
        });
      }
    );

    test(
      "lista os agendamentos administrativos sem contato do cliente final",
      async () => {
        adminOperationService
          .listarAgendamentosAdmin
          .mockResolvedValue({
            agendamentos: [
              {
                id:
                  50,

                data:
                  "2026-07-17",

                horario:
                  "14:00",

                status:
                  "cancelado",

                cliente_id:
                  null,

                cliente_nome:
                  "Maria",

                negocio_id:
                  11,

                negocio:
                  "Studio Victor",

                servico_id:
                  4,

                servico:
                  "Alongamento",

                profissional_id:
                  8,

                profissional:
                  "Ana",

                valor:
                  80,
              },
            ],
            paginacao: {
              pagina: 1,
              limite: 25,
              total: 1,
              totalPaginas: 1,
            },
          });

        const resposta =
          await request(app)
            .get(
              "/admin/agendamentos?busca=Maria&status=cancelado"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          adminOperationService
            .listarAgendamentosAdmin
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          adminOperationService
            .listarAgendamentosAdmin
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            busca: "Maria",
            status: "cancelado",
          })
        );

        expect(
          resposta.body.agendamentos
        ).toHaveLength(1);

        expect(
          resposta.body.agendamentos[0]
        ).toMatchObject({
          id:
            50,

          cliente_nome:
            "Maria",

          negocio:
            "Studio Victor",

          servico:
            "Alongamento",

          profissional:
            "Ana",

          valor:
            80,
        });

        expect(
          resposta.body.agendamentos[0]
        ).not.toHaveProperty(
          "cliente_whatsapp"
        );
      }
    );

    test(
      "retorna os dados administrativos de marketing",
      async () => {
        adminService
          .buscarMarketingAdmin
          .mockResolvedValue({
            negociosMaisAgendados: [
              {
                id:
                  11,

                nome:
                  "Studio Victor",

                total:
                  30,

                faturamento:
                  2400,
              },
            ],

            negociosMaisVistos: [
              {
                id:
                  11,

                nome:
                  "Studio Victor",

                visitas:
                  200,

                cliques_whatsapp:
                  35,

                cliques_maps:
                  18,
              },
            ],

            cidades: [
              {
                cidade:
                  "Goiânia",

                total:
                  8,
              },
            ],

            usuariosRecentes: [
              {
                id:
                  7,

                nome:
                  "Victor",

                email:
                  "victor@email.com",

                perfil:
                  "admin",

                tipo:
                  "admin",

                papel_admin:
                  "admin",
              },
            ],
          });

        const resposta =
          await request(app)
            .get(
              "/admin/marketing"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          adminService
            .buscarMarketingAdmin
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          resposta.body
            .negociosMaisAgendados
        ).toHaveLength(1);

        expect(
          resposta.body
            .negociosMaisVistos
        ).toHaveLength(1);

        expect(
          resposta.body.cidades
        ).toEqual([
          {
            cidade:
              "Goiânia",

            total:
              8,
          },
        ]);

        expect(
          resposta.body
            .usuariosRecentes[0]
        ).toMatchObject({
          id:
            7,

          perfil:
            "admin",

          papel_admin:
            "admin",
        });
      }
    );

    test(
      "encaminha falhas do service para o middleware central",
      async () => {
        adminService
          .buscarDashboardAdmin
          .mockRejectedValue(
            new Error(
              "Banco indisponível"
            )
          );

        const resposta =
          await request(app)
            .get(
              "/admin/dashboard"
            );

        expect(
          resposta.status
        ).toBe(500);

        expect(
          resposta.body
        ).toEqual({
          erro:
            "Erro interno do servidor.",
        });
      }
    );

    test(
      "não disponibiliza método POST no dashboard administrativo",
      async () => {
        const resposta =
          await request(app)
            .post(
              "/admin/dashboard"
            )
            .send({
              periodo:
                "7",
            });

        expect(
          resposta.status
        ).toBe(404);

        expect(
          adminService
            .buscarDashboardAdmin
        ).not.toHaveBeenCalled();
      }
    );
  }
);
