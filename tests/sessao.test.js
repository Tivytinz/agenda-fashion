const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET =
  "segredo-exclusivo-dos-testes";

jest.mock(
  "../src/repositories/sessaoRepository",
  () => ({
    buscarUsuarioPorId:
      jest.fn(),

    buscarVinculosAtivosPorUsuarioId:
      jest.fn(),

    buscarContextoAtivoPorUsuarioId:
      jest.fn(),
  })
);

const sessaoRepository = require(
  "../src/repositories/sessaoRepository"
);

const sessaoRoutes = require(
  "../src/routes/sessaoRoutes"
);

function criarApp() {
  const app = express();

  app.use(express.json());
  app.use(sessaoRoutes);

  app.use(
    (
      erro,
      req,
      res,
      next
    ) => {
      const status =
        erro.statusCode ||
        erro.status ||
        500;

      return res
        .status(status)
        .json({
          erro:
            erro.message ||
            "Erro interno do servidor.",
        });
    }
  );

  return app;
}

function gerarToken(
  usuarioId = 1
) {
  return jwt.sign(
    {
      id:
        usuarioId,
    },

    process.env.JWT_SECRET,

    {
      expiresIn:
        "1h",
    }
  );
}

function criarUsuario(
  alteracoes = {}
) {
  return {
    id: 1,
    nome: "Victor Souza",
    email: "victor@email.com",
    foto_url: "/uploads/usuarios/victor.jpg",
    whatsapp: "62999999999",
    aceita_notificacoes_whatsapp: true,
    ativo: true,
    email_verificado_em: null,
    ultimo_login_em:
      "2026-07-16T18:00:00.000Z",
    senha_alterada_em:
      "2026-07-16T12:00:00.000Z",
    created_at:
      "2026-07-16T12:00:00.000Z",
    updated_at:
      "2026-07-16T18:00:00.000Z",
    ...alteracoes,
  };
}

function criarContextoDono(
  alteracoes = {}
) {
  return {
    vinculo_id: 10,
    papel: "dono",
    vinculado_em:
      "2026-07-16T19:00:00.000Z",

    negocio_id: 5,
    negocio_nome:
      "Studio Victor",
    negocio_slug:
      "studio-victor",
    negocio_descricao:
      "Salão especializado.",
    negocio_setor:
      "Salão de beleza",
    negocio_whatsapp:
      "62999999999",
    negocio_foto_url:
      null,
    negocio_cidade:
      "Goiânia",
    negocio_estado:
      "GO",
    negocio_bairro:
      "Centro",
    negocio_endereco:
      "Rua Principal",
    negocio_numero:
      "100",
    negocio_complemento:
      null,
    negocio_cep:
      "74000000",
    negocio_localizacao_url:
      null,
    negocio_latitude:
      null,
    negocio_longitude:
      null,
    negocio_fuso_horario:
      "America/Sao_Paulo",
    negocio_publicado:
      false,
    negocio_created_at:
      "2026-07-16T19:00:00.000Z",
    negocio_updated_at:
      "2026-07-16T19:00:00.000Z",

    ...alteracoes,
  };
}

describe(
  "GET /minha-sessao",
  () => {
    let app;

    beforeEach(() => {
      app = criarApp();

      jest.clearAllMocks();
    });

    test(
      "retorna 401 quando o token não é enviado",
      async () => {
        const resposta =
          await request(app)
            .get(
              "/minha-sessao"
            );

        expect(
          resposta.status
        ).toBe(401);

        expect(
          resposta.body.erro
        ).toBe(
          "Token não enviado ou formato inválido."
        );

        expect(
          sessaoRepository
            .buscarUsuarioPorId
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 401 quando o token é inválido",
      async () => {
        const resposta =
          await request(app)
            .get(
              "/minha-sessao"
            )
            .set(
              "Authorization",
              "Bearer token-invalido"
            );

        expect(
          resposta.status
        ).toBe(401);

        expect(
          resposta.body.erro
        ).toBe(
          "Token inválido."
        );
      }
    );

    test(
      "retorna conta comum sem negócio",
      async () => {
        sessaoRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            criarUsuario()
          );

        sessaoRepository
          .buscarContextoAtivoPorUsuarioId
          .mockResolvedValue(
            null
          );

        const resposta =
          await request(app)
            .get(
              "/minha-sessao"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          sessaoRepository
            .buscarUsuarioPorId
        ).toHaveBeenCalledWith(
          1
        );

        expect(
          sessaoRepository
            .buscarContextoAtivoPorUsuarioId
        ).toHaveBeenCalledWith(
          1
        );

        expect(
          resposta.body
        ).toMatchObject({
          usuario: {
            id: 1,
            nome:
              "Victor Souza",
            email:
              "victor@email.com",
            foto_url:
              "/uploads/usuarios/victor.jpg",
            whatsapp:
              "62999999999",
            aceita_notificacoes_whatsapp:
              true,
            ativo: true,
          },

          temNegocio:
            false,

          negocio:
            null,
        });

        expect(
          resposta.body.usuario
        ).not.toHaveProperty(
          "senha"
        );

        expect(
          resposta.body.usuario
        ).not.toHaveProperty(
          "tipo"
        );
      }
    );

    test(
      "retorna o negócio e o papel de dono",
      async () => {
        sessaoRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            criarUsuario()
          );

        sessaoRepository
          .buscarContextoAtivoPorUsuarioId
          .mockResolvedValue(
            criarContextoDono()
          );

        const resposta =
          await request(app)
            .get(
              "/minha-sessao"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          resposta.body.temNegocio
        ).toBe(true);

        expect(
          resposta.body.negocio
        ).toMatchObject({
          id: 5,
          nome:
            "Studio Victor",
          slug:
            "studio-victor",
          papel:
            "dono",
          vinculo_id:
            10,
          publicado:
            false,
          cidade:
            "Goiânia",
          estado:
            "GO",
        });
      }
    );

    test(
      "retorna o negócio e o papel profissional",
      async () => {
        sessaoRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            criarUsuario()
          );

        sessaoRepository
          .buscarContextoAtivoPorUsuarioId
          .mockResolvedValue(
            criarContextoDono({
              papel:
                "profissional",

              vinculo_id:
                20,
            })
          );

        const resposta =
          await request(app)
            .get(
              "/minha-sessao"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          resposta.body.negocio.papel
        ).toBe(
          "profissional"
        );

        expect(
          resposta.body.negocio.vinculo_id
        ).toBe(20);
      }
    );

    test(
      "retorna 401 quando a conta não existe",
      async () => {
        sessaoRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            null
          );

        const resposta =
          await request(app)
            .get(
              "/minha-sessao"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            );

        expect(
          resposta.status
        ).toBe(401);

        expect(
          resposta.body.erro
        ).toBe(
          "Sessão inválida."
        );

        expect(
          sessaoRepository
            .buscarContextoAtivoPorUsuarioId
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 403 quando a conta está desativada",
      async () => {
        sessaoRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            criarUsuario({
              ativo:
                false,
            })
          );

        const resposta =
          await request(app)
            .get(
              "/minha-sessao"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            );

        expect(
          resposta.status
        ).toBe(403);

        expect(
          resposta.body.erro
        ).toBe(
          "Esta conta está desativada."
        );

        expect(
          sessaoRepository
            .buscarContextoAtivoPorUsuarioId
        ).not.toHaveBeenCalled();
      }
    );
  }
);
