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
  "../src/repositories/adminSaasHealthRepository",
  () => ({
    buscarResumo:
      jest.fn(),
    listarPerfisIncompletos:
      jest.fn(),
  })
);

const repository = require(
  "../src/repositories/adminSaasHealthRepository"
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
  "saúde do SaaS",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      repository.buscarResumo
        .mockResolvedValue({
          total_profissionais: 8,
          total_incompletos: 6,
          sem_negocio: 1,
          perfil_incompleto: 4,
          sem_descricao: 5,
          sem_servico: 3,
          sem_agenda: 5,
          nao_publicados: 4,
          completos: 2,
        });
      repository
        .listarPerfisIncompletos
        .mockResolvedValue([]);
    });

    test(
      "protege os dados de contato com permissão administrativa",
      async () => {
        const resposta =
          await request(criarApp())
            .get(
              "/admin/saude/perfis-incompletos"
            )
            .set(
              "x-test-admin",
              "no"
            );

        expect(resposta.status)
          .toBe(403);
        expect(
          repository.buscarResumo
        ).not.toHaveBeenCalled();
        expect(
          repository
            .listarPerfisIncompletos
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "filtra, pagina e explica as pendências do perfil",
      async () => {
        repository
          .listarPerfisIncompletos
          .mockResolvedValue([
            {
              usuario_id: "42",
              usuario_nome:
                "Ana Souza",
              email:
                "ana@example.com",
              usuario_whatsapp:
                "11987654321",
              cadastro_em:
                "2026-08-01T12:00:00.000Z",
              ultimo_login_em: null,
              ultima_atividade_em:
                "2026-08-02T12:00:00.000Z",
              utm_source: "meta",
              utm_campaign:
                "profissionais-sp",
              negocio_id: "19",
              negocio_nome:
                "Studio Ana",
              negocio_slug:
                "studio-ana",
              descricao: null,
              areas: [],
              setor: null,
              negocio_whatsapp: null,
              cidade:
                "São Paulo",
              estado: "SP",
              publicado: false,
              possui_servico_ativo:
                false,
              configurado_em: null,
              tem_negocio: true,
              perfil_basico_completo:
                false,
              agenda_configurada:
                false,
              etapas_concluidas: 1,
              total_resultados: "11",
            },
          ]);

        const resposta =
          await request(criarApp())
            .get(
              "/admin/saude/perfis-incompletos?pendencia=agenda&pagina=2&limite=10&busca=%20Ana%20"
            );

        expect(resposta.status)
          .toBe(200);
        expect(
          repository
            .listarPerfisIncompletos
        ).toHaveBeenCalledWith({
          busca: "Ana",
          pendencia: "agenda",
          limite: 10,
          offset: 10,
        });
        expect(resposta.body.resumo)
          .toEqual({
            totalProfissionais: 8,
            totalIncompletos: 6,
            semNegocio: 1,
            perfilIncompleto: 4,
            semDescricao: 5,
            semServico: 3,
            semAgenda: 5,
            naoPublicados: 4,
            completos: 2,
          });
        expect(
          resposta.body.perfis[0]
            .progresso
        ).toEqual({
          etapasConcluidas: 1,
          totalEtapas: 5,
          percentual: 20,
        });
        expect(
          resposta.body.perfis[0]
            .pendencias
            .map(
              (item) => item.codigo
            )
        ).toEqual([
          "descricao",
          "especialidade",
          "whatsapp",
          "servico",
          "agenda",
          "publicacao",
        ]);
        expect(
          resposta.body.perfis[0]
            .pendencias[0].rotulo
        ).toBe(
          "Adicionar descrição (recomendado)"
        );
        expect(
          resposta.body.perfis[0]
            .pendencias[0].tipo
        ).toBe("recomendacao");
        expect(
          resposta.body.paginacao
        ).toEqual({
          pagina: 2,
          limite: 10,
          total: 11,
          totalPaginas: 2,
        });
      }
    );

    test(
      "aceita filtrar recomendações de descrição separadamente",
      async () => {
        await request(criarApp())
          .get(
            "/admin/saude/perfis-incompletos?pendencia=descricao"
          );

        expect(
          repository
            .listarPerfisIncompletos
        ).toHaveBeenCalledWith({
          busca: "",
          pendencia: "descricao",
          limite: 25,
          offset: 0,
        });
      }
    );

    test(
      "normaliza filtros e paginação inválidos",
      async () => {
        await request(criarApp())
          .get(
            "/admin/saude/perfis-incompletos?pendencia=desconhecida&pagina=0&limite=500"
          );

        expect(
          repository
            .listarPerfisIncompletos
        ).toHaveBeenCalledWith({
          busca: "",
          pendencia: "todos",
          limite: 25,
          offset: 0,
        });
      }
    );
  }
);
