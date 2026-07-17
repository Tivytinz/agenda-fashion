jest.setTimeout(30000);

/*
 * O repository é simulado para testar:
 *
 * - rota;
 * - middleware de autenticação;
 * - controller;
 * - service;
 *
 * sem depender dos registros reais existentes
 * no banco de dados.
 */
jest.mock(
  "../src/repositories/dashboardRepository",
  () => ({
    buscarNegocioDoUsuario:
      jest.fn(),

    buscarResumoProfissional:
      jest.fn(),

    buscarProximoAtendimentoProfissional:
      jest.fn(),

    listarProximosAtendimentosProfissional:
      jest.fn(),

    buscarServicosMaisVendidosProfissional:
      jest.fn(),

    buscarResumoDono:
      jest.fn(),

    buscarClientesRecorrentes:
      jest.fn(),

    buscarPerformanceNegocio:
      jest.fn(),

    buscarFavoritosRecebidos:
      jest.fn(),

    buscarResumoDias:
      jest.fn(),

    buscarRankingProfissionais:
      jest.fn(),

    buscarRankingServicos:
      jest.fn(),

    buscarRankingClientes:
      jest.fn(),
  })
);

const jwt = require(
  "jsonwebtoken"
);

const request = require(
  "supertest"
);

const app = require(
  "../src/server"
);

const dashboardRepository = require(
  "../src/repositories/dashboardRepository"
);

function obterJwtSecretTeste() {
  const segredo =
    String(
      process.env.JWT_SECRET ||
      ""
    ).trim();

  if (!segredo) {
    throw new Error(
      "JWT_SECRET não está disponível durante o teste."
    );
  }

  return segredo;
}

function criarToken(
  usuarioId
) {
  return jwt.sign(
    {
      id:
        usuarioId,
    },

    obterJwtSecretTeste(),

    {
      expiresIn:
        "1h",
    }
  );
}

function criarTokenComOutraChave(
  usuarioId
) {
  return jwt.sign(
    {
      id:
        usuarioId,
    },

    `${obterJwtSecretTeste()}-incorreta`,

    {
      expiresIn:
        "1h",
    }
  );
}

function obterMensagemErro(
  resposta
) {
  return (
    resposta.body.erro ||
    resposta.body.mensagem ||
    resposta.body.message ||
    ""
  );
}

function configurarRepositorioDono() {
  dashboardRepository
    .buscarNegocioDoUsuario
    .mockResolvedValue({
      negocio_id:
        "11",

      papel:
        "dono",

      nome:
        "Studio Fashion",

      slug:
        "studio-fashion",
    });

  dashboardRepository
    .buscarResumoDono
    .mockResolvedValue({
      agendamentos_hoje:
        "3",

      agendamentos_periodo:
        "6",

      faturamento_hoje:
        "300.00",

      faturamento_periodo:
        "600.00",

      clientes_novos:
        "5",

      servicos_vendidos:
        "6",
    });

  dashboardRepository
    .buscarClientesRecorrentes
    .mockResolvedValue(
      "2"
    );

  dashboardRepository
    .buscarPerformanceNegocio
    .mockResolvedValue({
      visitas_perfil:
        "24",

      cliques_whatsapp:
        "10",

      cliques_maps:
        "4",
    });

  dashboardRepository
    .buscarFavoritosRecebidos
    .mockResolvedValue(
      "8"
    );

  dashboardRepository
    .buscarResumoDias
    .mockResolvedValue([
      {
        data:
          "14/07",

        agendamentos:
          3,

        faturamento:
          "300.00",
      },

      {
        data:
          "15/07",

        agendamentos:
          3,

        faturamento:
          "300.00",
      },
    ]);

  dashboardRepository
    .buscarRankingProfissionais
    .mockResolvedValue([
      {
        id:
          7,

        nome:
          "Juliana",

        total:
          4,

        faturamento:
          "400.00",
      },
    ]);

  dashboardRepository
    .buscarRankingServicos
    .mockResolvedValue([
      {
        id:
          5,

        nome:
          "Alongamento em gel",

        total:
          4,

        faturamento:
          "480.00",
      },
    ]);

  dashboardRepository
    .buscarRankingClientes
    .mockResolvedValue([
      {
        id:
          30,

        nome:
          "Maria",

        total:
          3,

        faturamento:
          "360.00",
      },
    ]);
}

describe(
  "GET /dashboard-dono",
  () => {
    beforeEach(
      () => {
        jest.resetAllMocks();
      }
    );

    test(
      "recusa acesso sem token",
      async () => {
        const resposta =
          await request(app)
            .get(
              "/dashboard-dono"
            );

        expect(
          resposta.statusCode
        ).toBe(
          401
        );

        expect(
          resposta.body
        ).toEqual({
          erro:
            "Token não enviado ou formato inválido.",
        });

        expect(
          dashboardRepository
            .buscarNegocioDoUsuario
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "recusa acesso com token inválido",
      async () => {
        const resposta =
          await request(app)
            .get(
              "/dashboard-dono"
            )
            .set(
              "Authorization",
              "Bearer token-invalido"
            );

        expect(
          resposta.statusCode
        ).toBe(
          401
        );

        expect(
          resposta.body
        ).toEqual({
          erro:
            "Token inválido.",
        });

        expect(
          dashboardRepository
            .buscarNegocioDoUsuario
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "recusa token assinado com outra chave",
      async () => {
        const token =
          criarTokenComOutraChave(
            1
          );

        const resposta =
          await request(app)
            .get(
              "/dashboard-dono"
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          resposta.statusCode
        ).toBe(
          401
        );

        expect(
          resposta.body
        ).toEqual({
          erro:
            "Token inválido.",
        });

        expect(
          dashboardRepository
            .buscarNegocioDoUsuario
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "impede profissional comum de acessar o dashboard do dono",
      async () => {
        dashboardRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue({
            negocio_id:
              "11",

            papel:
              "profissional",

            nome:
              "Studio Fashion",

            slug:
              "studio-fashion",
          });

        const token =
          criarToken(
            7
          );

        const resposta =
          await request(app)
            .get(
              "/dashboard-dono"
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          resposta.statusCode
        ).toBe(
          403
        );

        expect(
          obterMensagemErro(
            resposta
          )
        ).toContain(
          "Apenas o dono pode acessar este dashboard."
        );

        expect(
          dashboardRepository
            .buscarNegocioDoUsuario
        ).toHaveBeenCalledWith(
          7
        );

        expect(
          dashboardRepository
            .buscarResumoDono
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "dono autenticado recebe o dashboard completo",
      async () => {
        configurarRepositorioDono();

        const token =
          criarToken(
            1
          );

        const resposta =
          await request(app)
            .get(
              "/dashboard-dono?periodo=7dias"
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          resposta.statusCode
        ).toBe(
          200
        );

        expect(
          dashboardRepository
            .buscarNegocioDoUsuario
        ).toHaveBeenCalledWith(
          1
        );

        expect(
          dashboardRepository
            .buscarResumoDono
        ).toHaveBeenCalledWith(
          11,

          expect.stringContaining(
            "INTERVAL '7 days'"
          )
        );

        expect(
          resposta.body
        ).toMatchObject({
          periodo:
            "7dias",

          negocio: {
            negocio_id:
              11,

            papel:
              "dono",

            nome:
              "Studio Fashion",

            slug:
              "studio-fashion",
          },

          resumo: {
            agendamentos_hoje:
              3,

            agendamentos_periodo:
              6,

            faturamento_hoje:
              300,

            faturamento_periodo:
              600,

            clientes_novos:
              5,

            clientes_recorrentes:
              2,

            servicos_vendidos:
              6,

            ticket_medio:
              100,
          },

          performance: {
            visitas_perfil:
              24,

            cliques_whatsapp:
              10,

            cliques_maps:
              4,

            favoritos_recebidos:
              8,

            taxa_conversao:
              25,
          },
        });

        expect(
          resposta.body
            .resumo_dias
        ).toHaveLength(
          2
        );

        expect(
          resposta.body
            .ranking_profissionais
        ).toHaveLength(
          1
        );

        expect(
          resposta.body
            .ranking_servicos
        ).toHaveLength(
          1
        );

        expect(
          resposta.body
            .ranking_clientes
        ).toHaveLength(
          1
        );
      }
    );

    test.each([
      [
        "hoje",
        "a.data =",
      ],

      [
        "7dias",
        "INTERVAL '7 days'",
      ],

      [
        "30dias",
        "INTERVAL '30 days'",
      ],

      [
        "mes",
        "date_trunc('month', a.data)",
      ],
    ])(
      "aplica corretamente o filtro %s",
      async (
        periodo,
        trechoEsperado
      ) => {
        configurarRepositorioDono();

        const token =
          criarToken(
            1
          );

        const resposta =
          await request(app)
            .get(
              `/dashboard-dono?periodo=${periodo}`
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          resposta.statusCode
        ).toBe(
          200
        );

        expect(
          resposta.body.periodo
        ).toBe(
          periodo
        );

        expect(
          dashboardRepository
            .buscarResumoDono
        ).toHaveBeenCalledWith(
          11,

          expect.stringContaining(
            trechoEsperado
          )
        );

        expect(
          dashboardRepository
            .buscarResumoDias
        ).toHaveBeenCalledWith(
          11,

          expect.stringContaining(
            trechoEsperado
          )
        );

        expect(
          dashboardRepository
            .buscarRankingProfissionais
        ).toHaveBeenCalledWith(
          11,

          expect.stringContaining(
            trechoEsperado
          )
        );

        expect(
          dashboardRepository
            .buscarRankingServicos
        ).toHaveBeenCalledWith(
          11,

          expect.stringContaining(
            trechoEsperado
          )
        );

        expect(
          dashboardRepository
            .buscarRankingClientes
        ).toHaveBeenCalledWith(
          11,

          expect.stringContaining(
            trechoEsperado
          )
        );
      }
    );
  }
);