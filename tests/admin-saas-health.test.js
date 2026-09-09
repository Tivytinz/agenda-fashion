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
    contarPerfisIncompletos:
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

function perfilBase(sobrescritas = {}) {
  return {
    usuario_id: "42",
    usuario_nome: "Ana Souza",
    email: "ana@example.com",
    usuario_whatsapp: "11987654321",
    whatsapp_contato_autorizado: true,
    cadastro_em: "2026-08-01T12:00:00.000Z",
    ultimo_login_em: null,
    ultima_atividade_em: "2026-08-02T12:00:00.000Z",
    utm_source: "meta",
    utm_campaign: "profissionais-sp",
    negocio_id: "19",
    negocio_nome: "Studio Ana",
    negocio_slug: "studio-ana",
    descricao: "Descrição",
    areas: ["Unhas"],
    setor: "Unhas",
    negocio_whatsapp: "11987654321",
    cidade: "São Paulo",
    estado: "SP",
    bairro: "Centro",
    endereco: "Rua das Flores",
    numero: "10",
    cep: "01001000",
    localizacao_url: "https://maps.google.com/",
    publicado: false,
    possui_servico_ativo: false,
    configurado_em: null,
    tem_negocio: true,
    perfil_basico_completo: true,
    disponibilidade_inicializada: false,
    primeiro_agendamento_valido: false,
    etapas_concluidas: 2,
    total_resultados: "1",
    ...sobrescritas,
  };
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
          sem_disponibilidade_inicial: 2,
          nao_publicados: 4,
          sem_primeiro_agendamento: 1,
          completos: 1,
        });
      repository
        .listarPerfisIncompletos
        .mockResolvedValue([]);
      repository
        .contarPerfisIncompletos
        .mockResolvedValue(0);
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
        expect(
          repository
            .contarPerfisIncompletos
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "usa cinco etapas e mantém disponibilidade como diagnóstico técnico",
      async () => {
        repository
          .listarPerfisIncompletos
          .mockResolvedValue([
            perfilBase({
              descricao: null,
              areas: [],
              setor: null,
              negocio_whatsapp: null,
              perfil_basico_completo: false,
              etapas_concluidas: 1,
              total_resultados: "11",
            }),
          ]);

        const resposta =
          await request(criarApp())
            .get(
              "/admin/saude/perfis-incompletos?pendencia=perfil&pagina=2&limite=10&busca=%20Ana%20"
            );

        expect(resposta.status)
          .toBe(200);
        expect(
          repository
            .listarPerfisIncompletos
        ).toHaveBeenCalledWith({
          busca: "Ana",
          pendencia: "perfil",
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
            disponibilidadeNaoInicializada: 2,
            naoPublicados: 4,
            semPrimeiroAgendamento: 1,
            completos: 1,
          });
        expect(
          resposta.body.perfis[0]
            .progresso
        ).toEqual({
          etapasConcluidas: 1,
          totalEtapas: 5,
          percentual: 20,
          etapasRestantes: 4,
        });
        expect(
          resposta.body.perfis[0]
            .pendencias
            .map(
              (item) => item.codigo
            )
        ).toEqual([
          "especialidade",
          "whatsapp",
          "servico",
          "disponibilidade",
          "descricao",
        ]);
        expect(
          resposta.body.perfis[0]
            .proximaAcao.codigo
        ).toBe("especialidade");
        expect(
          resposta.body.perfis[0]
            .pendencias.find(
              (item) => item.codigo === "disponibilidade"
            )
        ).toEqual({
          codigo: "disponibilidade",
          rotulo: "Reprocessar disponibilidade inicial",
          tipo: "sistema",
        });
        expect(
          resposta.body.perfis[0]
            .pendencias.at(-1)
        ).toEqual({
          codigo: "descricao",
          rotulo: "Adicionar descrição (opcional)",
          tipo: "recomendacao",
        });
        expect(
          resposta.body.perfis[0]
            .whatsappAutorizado
        ).toBe(true);
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
      "prioriza reprocessar publicação quando publicação e disponibilidade falham juntas",
      async () => {
        repository
          .listarPerfisIncompletos
          .mockResolvedValue([
            perfilBase({
              descricao: "",
              possui_servico_ativo: true,
              perfil_basico_completo: true,
              publicado: false,
              disponibilidade_inicializada: false,
              etapas_concluidas: 3,
            }),
          ]);

        const resposta =
          await request(criarApp())
            .get(
              "/admin/saude/perfis-incompletos"
            );

        expect(
          resposta.body.perfis[0]
            .pendencias
            .map((item) => item.codigo)
        ).toEqual([
          "publicacao",
          "disponibilidade",
          "descricao",
        ]);
        expect(
          resposta.body.perfis[0]
            .proximaAcao
        ).toEqual({
          codigo: "publicacao",
          rotulo: "Reprocessar publicação automática",
          tipo: "sistema",
        });
        expect(
          resposta.body.perfis[0]
            .progresso
        ).toEqual({
          etapasConcluidas: 3,
          totalEtapas: 5,
          percentual: 60,
          etapasRestantes: 2,
        });
      }
    );

    test(
      "agenda não bloqueia publicação nem reduz a ativação de perfil publicado",
      async () => {
        repository
          .listarPerfisIncompletos
          .mockResolvedValue([
            perfilBase({
              publicado: true,
              possui_servico_ativo: true,
              disponibilidade_inicializada: false,
              primeiro_agendamento_valido: false,
              etapas_concluidas: 4,
            }),
          ]);

        const resposta = await request(criarApp())
          .get("/admin/saude/perfis-incompletos?pendencia=primeiro_agendamento");

        expect(resposta.body.perfis[0].progresso).toEqual({
          etapasConcluidas: 4,
          totalEtapas: 5,
          percentual: 80,
          etapasRestantes: 1,
        });
        expect(resposta.body.perfis[0].proximaAcao).toEqual({
          codigo: "primeiro_agendamento",
          rotulo: "Divulgar perfil para conquistar o 1º agendamento",
        });
        expect(
          resposta.body.perfis[0]
            .pendencias
            .map((item) => item.codigo)
        ).toEqual([
          "disponibilidade",
          "primeiro_agendamento",
        ]);
      }
    );

    test(
      "primeiro agendamento válido conclui 100% mesmo sem disponibilidade inicializada",
      async () => {
        repository
          .listarPerfisIncompletos
          .mockResolvedValue([
            perfilBase({
              publicado: true,
              possui_servico_ativo: true,
              disponibilidade_inicializada: false,
              primeiro_agendamento_valido: true,
              etapas_concluidas: 5,
            }),
          ]);

        const resposta = await request(criarApp())
          .get("/admin/saude/perfis-incompletos?pendencia=disponibilidade");

        expect(repository.listarPerfisIncompletos).toHaveBeenCalledWith({
          busca: "",
          pendencia: "disponibilidade",
          limite: 25,
          offset: 0,
        });
        expect(resposta.body.perfis[0].progresso).toEqual({
          etapasConcluidas: 5,
          totalEtapas: 5,
          percentual: 100,
          etapasRestantes: 0,
        });
        expect(resposta.body.perfis[0].proximaAcao).toEqual({
          codigo: "disponibilidade",
          rotulo: "Reprocessar disponibilidade inicial",
          tipo: "sistema",
        });
      }
    );

    test(
      "normaliza filtros e paginação inválidos",
      async () => {
        await request(criarApp())
          .get(
            "/admin/saude/perfis-incompletos?pendencia=agenda&pagina=0&limite=500"
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

    test(
      "preserva o total do diagnóstico técnico quando a página solicitada está vazia",
      async () => {
        repository
          .contarPerfisIncompletos
          .mockResolvedValue(26);

        const resposta =
          await request(criarApp())
            .get(
              "/admin/saude/perfis-incompletos?pendencia=disponibilidade&pagina=4&limite=10&busca=Ana"
            );

        expect(resposta.status)
          .toBe(200);
        expect(
          repository
            .contarPerfisIncompletos
        ).toHaveBeenCalledWith({
          busca: "Ana",
          pendencia: "disponibilidade",
        });
        expect(
          resposta.body.paginacao
        ).toEqual({
          pagina: 4,
          limite: 10,
          total: 26,
          totalPaginas: 3,
        });
        expect(
          resposta.body.perfis
        ).toEqual([]);
      }
    );
  }
);