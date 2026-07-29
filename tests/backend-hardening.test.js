const db = require(
  "../src/db/db"
);

jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn()
  })
);

const errorHandler = require(
  "../src/middlewares/errorHandler"
);

const agendaRepository = require(
  "../src/repositories/agendaRepository"
);

const checkoutRepository = require(
  "../src/repositories/checkoutRepository"
);

const assinaturaRepository = require(
  "../src/repositories/assinaturaRepository"
);

const servicosRepository = require(
  "../src/repositories/servicosRepository"
);

const configuracoesRepository = require(
  "../src/repositories/configuracoesRepository"
);

const dashboardRepository = require(
  "../src/repositories/dashboardRepository"
);

function criarResposta() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

describe(
  "Proteções do backend",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      db.query.mockResolvedValue({
        rows: []
      });
    });

    test(
      "preserva o status de erros operacionais legados",
      () => {
        const erro =
          new Error(
            "Recurso não encontrado."
          );

        erro.statusCode = 404;

        const resposta =
          criarResposta();

        errorHandler(
          erro,
          {
            originalUrl:
              "/servicos/999",
            method: "PUT"
          },
          resposta,
          jest.fn()
        );

        expect(
          resposta.status
        ).toHaveBeenCalledWith(404);

        expect(
          resposta.json
        ).toHaveBeenCalledWith({
          erro:
            "Recurso não encontrado."
        });
      }
    );

    test(
      "não aceita status inválido como erro operacional",
      () => {
        const erro =
          new Error(
            "Detalhe interno."
          );

        erro.statusCode = 200;

        const resposta =
          criarResposta();

        errorHandler(
          erro,
          {
            originalUrl:
              "/interno",
            method: "GET"
          },
          resposta,
          jest.fn()
        );

        expect(
          resposta.status
        ).toHaveBeenCalledWith(500);

        expect(
          resposta.json
        ).toHaveBeenCalledWith({
          erro:
            "Erro interno do servidor."
        });
      }
    );

    test(
      "usa os dados gravados no agendamento quando a cliente é visitante",
      async () => {
        await agendaRepository
          .buscarAgendamentosPorPeriodo(
            8,
            "2026-07-29",
            "2026-08-05"
          );

        const consulta =
          db.query.mock.calls[0][0];

        expect(consulta)
          .toContain(
            "NULLIF(BTRIM(a.cliente_nome), '')"
          );

        expect(consulta)
          .toContain(
            "NULLIF(BTRIM(a.cliente_whatsapp), '')"
          );
      }
    );

    test(
      "exige conta, vínculo e negócio ativos nas autorizações centrais",
      async () => {
        await checkoutRepository
          .buscarNegocioDono(
            null,
            1
          );

        await assinaturaRepository
          .buscarNegocioDono(1);

        await servicosRepository
          .buscarNegocioDono(1);

        await configuracoesRepository
          .buscarNegocioDoUsuario(1);

        await dashboardRepository
          .buscarNegocioDoUsuario(1);

        for (
          const [consulta]
          of db.query.mock.calls
        ) {
          expect(consulta)
            .toMatch(
              /un\.ativo\s*=\s*TRUE/i
            );

          expect(consulta)
            .toMatch(
              /u\.ativo\s*=\s*TRUE/i
            );

          expect(consulta)
            .toMatch(
              /n\.ativo\s*=\s*TRUE/i
            );
        }
      }
    );
  }
);
