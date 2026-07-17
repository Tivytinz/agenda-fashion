const express = require(
  "express"
);

const request = require(
  "supertest"
);

const jwt = require(
  "jsonwebtoken"
);

process.env.JWT_SECRET =
  "segredo-exclusivo-dos-testes";

jest.mock(
  "../src/repositories/favoritosRepository",
  () => ({
    listarFavoritos:
      jest.fn(),

    buscarNegocio:
      jest.fn(),

    adicionarFavorito:
      jest.fn(),

    removerFavorito:
      jest.fn(),

    verificarFavorito:
      jest.fn(),
  })
);

const favoritosRepository = require(
  "../src/repositories/favoritosRepository"
);

const favoritosRoutes = require(
  "../src/routes/favoritosRoutes"
);

function criarApp() {
  const app = express();

  app.use(
    express.json()
  );

  app.use(
    favoritosRoutes
  );

  app.use(
    (
      erro,
      req,
      res,
      next
    ) => {
      const status =
        erro?.statusCode ||
        erro?.status ||
        (
          erro?.name ===
          "ValidationError"
            ? 400
            : erro?.name ===
                "NotFoundError"
              ? 404
              : 500
        );

      return res
        .status(status)
        .json({
          erro:
            erro?.message ||
            "Erro interno do servidor.",
        });
    }
  );

  return app;
}

function gerarToken(
  usuarioId = 7
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

function criarFavorito(
  alteracoes = {}
) {
  return {
    id: 1,
    nome:
      "Studio Victor",
    slug:
      "studio-victor",
    foto_url:
      null,
    descricao:
      "Negócio especializado em beleza.",
    setor:
      "Salão de beleza",
    cidade:
      "Goiânia",
    estado:
      "GO",
    bairro:
      "Centro",
    whatsapp_negocio:
      "62999999999",
    localizacao_url:
      null,
    favoritado_em:
      "2026-07-16T20:00:00.000Z",

    ...alteracoes,
  };
}

describe(
  "Rotas de favoritos",
  () => {
    let app;

    beforeEach(() => {
      app =
        criarApp();

      jest.clearAllMocks();
    });

    test(
      "retorna 401 quando o token não é enviado",
      async () => {
        const resposta =
          await request(app)
            .get(
              "/favoritos"
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
          favoritosRepository
            .listarFavoritos
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 401 quando o token é inválido",
      async () => {
        const resposta =
          await request(app)
            .get(
              "/favoritos"
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

        expect(
          favoritosRepository
            .listarFavoritos
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "lista favoritos com JWT contendo somente id",
      async () => {
        const token =
          gerarToken(7);

        const payload =
          jwt.decode(token);

        expect(
          payload
        ).toMatchObject({
          id: 7,
        });

        expect(
          payload
        ).not.toHaveProperty(
          "tipo"
        );

        favoritosRepository
          .listarFavoritos
          .mockResolvedValue([
            criarFavorito(),
          ]);

        const resposta =
          await request(app)
            .get(
              "/favoritos"
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          favoritosRepository
            .listarFavoritos
        ).toHaveBeenCalledWith(
          7
        );

        expect(
          resposta.body
        ).toEqual({
          favoritos: [
            expect.objectContaining({
              id: 1,
              nome:
                "Studio Victor",
              slug:
                "studio-victor",
              cidade:
                "Goiânia",
            }),
          ],
        });
      }
    );

    test(
      "adiciona um negócio aos favoritos sem exigir tipo de usuário",
      async () => {
        favoritosRepository
          .buscarNegocio
          .mockResolvedValue({
            id: 1,
            nome:
              "Studio Victor",
            slug:
              "studio-victor",
            ativo:
              true,
            publicado:
              true,
          });

        favoritosRepository
          .adicionarFavorito
          .mockResolvedValue({
            id: 10,
            usuario_id:
              7,
            negocio_id:
              1,
          });

        const resposta =
          await request(app)
            .post(
              "/favoritos/1"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken(
                7
              )}`
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          favoritosRepository
            .buscarNegocio
        ).toHaveBeenCalledWith(
          1
        );

        expect(
          favoritosRepository
            .adicionarFavorito
        ).toHaveBeenCalledWith(
          7,
          1
        );

        expect(
          resposta.body
        ).toEqual({
          mensagem:
            "Adicionado aos favoritos.",

          favoritado:
            true,
        });
      }
    );

    test(
      "retorna 404 quando o negócio não existe",
      async () => {
        favoritosRepository
          .buscarNegocio
          .mockResolvedValue(
            null
          );

        const resposta =
          await request(app)
            .post(
              "/favoritos/999"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken(
                7
              )}`
            );

        expect(
          resposta.status
        ).toBe(404);

        expect(
          resposta.body.erro
        ).toBe(
          "Negócio não encontrado."
        );

        expect(
          favoritosRepository
            .adicionarFavorito
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna o status do favorito",
      async () => {
        favoritosRepository
          .verificarFavorito
          .mockResolvedValue(
            true
          );

        const resposta =
          await request(app)
            .get(
              "/favoritos/1/status"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken(
                7
              )}`
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          favoritosRepository
            .verificarFavorito
        ).toHaveBeenCalledWith(
          7,
          1
        );

        expect(
          resposta.body
        ).toEqual({
          favoritado:
            true,
        });
      }
    );

    test(
      "remove um negócio dos favoritos",
      async () => {
        favoritosRepository
          .removerFavorito
          .mockResolvedValue({
            id: 10,
            usuario_id:
              7,
            negocio_id:
              1,
          });

        const resposta =
          await request(app)
            .delete(
              "/favoritos/1"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken(
                7
              )}`
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          favoritosRepository
            .removerFavorito
        ).toHaveBeenCalledWith(
          7,
          1
        );

        expect(
          resposta.body
        ).toEqual({
          mensagem:
            "Removido dos favoritos.",

          favoritado:
            false,
        });
      }
    );

    test.each([
      "abc",
      "0",
      "-1",
      "1.5",
    ])(
      "retorna 400 para negocioId inválido: %s",
      async (
        negocioId
      ) => {
        const resposta =
          await request(app)
            .post(
              `/favoritos/${negocioId}`
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken(
                7
              )}`
            );

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Negócio inválido."
        );

        expect(
          favoritosRepository
            .buscarNegocio
        ).not.toHaveBeenCalled();

        expect(
          favoritosRepository
            .adicionarFavorito
        ).not.toHaveBeenCalled();
      }
    );
  }
);