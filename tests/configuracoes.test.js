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
  "segredo-configuracoes-testes";

jest.mock(
  "../src/repositories/configuracoesRepository",
  () => ({
    buscarNegocioDoUsuario:
      jest.fn(),

    buscarNegocioPorId:
      jest.fn(),

    atualizarNegocio:
      jest.fn(),
  })
);

const configuracoesRepository =
  require(
    "../src/repositories/configuracoesRepository"
  );

const configuracoesRoutes =
  require(
    "../src/routes/configuracoesRoutes"
  );

function criarApp() {
  const app =
    express();

  app.use(
    express.json()
  );

  app.use(
    configuracoesRoutes
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
        500;

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

function criarVinculo(
  alteracoes = {}
) {
  return {
    negocio_id:
      11,

    papel:
      "dono",

    ...alteracoes,
  };
}

function criarNegocio(
  alteracoes = {}
) {
  return {
    id:
      11,

    negocio_id:
      11,

    nome:
      "Studio Victor",

    nome_negocio:
      "Studio Victor",

    slug:
      "studio-victor",

    foto_url:
      "https://cdn.teste/studio.png",

    foto_public_id:
      "negocios/studio-11",

    descricao:
      "Studio especializado em beleza.",

    setor:
      "Beleza",

    cidade:
      "Goiânia",

    bairro:
      "Centro",

    localizacao_url:
      "https://maps.google.com/",

    whatsapp:
      "62999999999",

    whatsapp_negocio:
      "62999999999",

    areas: [
      "Unhas",
      "Cabelo",
    ],

    created_at:
      "2026-07-16T18:00:00.000Z",

    updated_at:
      "2026-07-16T20:00:00.000Z",

    ...alteracoes,
  };
}

describe(
  "Rotas de configurações",
  () => {
    let app;

    beforeEach(() => {
      jest.clearAllMocks();

      app =
        criarApp();
    });

    test(
      "retorna 401 quando o token não é enviado",
      async () => {
        const resposta =
          await request(app)
            .get(
              "/configuracoes"
            );

        expect(
          resposta.status
        ).toBe(401);

        expect(
          configuracoesRepository
            .buscarNegocioDoUsuario
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "busca as configurações com JWT contendo somente id",
      async () => {
        const token =
          gerarToken(7);

        const payload =
          jwt.decode(token);

        expect(
          payload
        ).toMatchObject({
          id:
            7,
        });

        expect(
          payload
        ).not.toHaveProperty(
          "tipo"
        );

        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            criarNegocio()
          );

        const resposta =
          await request(app)
            .get(
              "/configuracoes"
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          configuracoesRepository
            .buscarNegocioDoUsuario
        ).toHaveBeenCalledWith(
          7
        );

        expect(
          configuracoesRepository
            .buscarNegocioPorId
        ).toHaveBeenCalledWith(
          11
        );

        expect(
          resposta.body.negocio
        ).toMatchObject({
          id:
            11,

          nome:
            "Studio Victor",

          whatsapp:
            "62999999999",

          whatsapp_negocio:
            "62999999999",

          areas: [
            "Unhas",
            "Cabelo",
          ],

          papel:
            "dono",
        });

        expect(
          resposta.body.configuracoes
        ).toEqual(
          resposta.body.negocio
        );
      }
    );

    test(
      "retorna 404 quando o usuário não possui vínculo",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            null
          );

        const resposta =
          await request(app)
            .get(
              "/configuracoes"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            );

        expect(
          resposta.status
        ).toBe(404);

        expect(
          resposta.body.erro
        ).toBe(
          "Usuário não está vinculado a nenhum negócio."
        );

        expect(
          configuracoesRepository
            .buscarNegocioPorId
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 404 quando o negócio vinculado não existe",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            null
          );

        const resposta =
          await request(app)
            .get(
              "/configuracoes"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            );

        expect(
          resposta.status
        ).toBe(404);

        expect(
          resposta.body.erro
        ).toBe(
          "Negócio não encontrado."
        );
      }
    );

    test(
      "normaliza e salva as configurações do dono",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            criarNegocio()
          );

        configuracoesRepository
          .atualizarNegocio
          .mockResolvedValue(
            criarNegocio({
              nome:
                "Studio Victor Premium",

              descricao:
                "Beleza e estética.",

              setor:
                "Estética",

              cidade:
                "Goiânia",

              bairro:
                "Setor Central",

              localizacao_url:
                "https://maps.google.com/?q=studio",

              whatsapp:
                "62988887777",

              whatsapp_negocio:
                "62988887777",

              areas: [
                "Unhas",
                "Cabelo",
              ],
            })
          );

        const resposta =
          await request(app)
            .put(
              "/configuracoes"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              nome:
                "  Studio   Victor Premium  ",

              descricao:
                "  Beleza   e estética.  ",

              setor:
                "  Estética  ",

              cidade:
                "  Goiânia  ",

              bairro:
                "  Setor   Central  ",

              localizacao_url:
                "https://maps.google.com/?q=studio",

              whatsapp_negocio:
                "+55 (62) 98888-7777",

              areas:
                JSON.stringify([
                  "Unhas",
                  " Cabelo ",
                  "unhas",
                ]),
            });

        expect(
          resposta.status
        ).toBe(200);

        expect(
          configuracoesRepository
            .atualizarNegocio
        ).toHaveBeenCalledWith(
          11,
          {
            nome:
              "Studio Victor Premium",

            foto_url:
              "https://cdn.teste/studio.png",

            descricao:
              "Beleza e estética.",

            setor:
              "Estética",

            cidade:
              "Goiânia",

            bairro:
              "Setor Central",

            localizacao_url:
              "https://maps.google.com/?q=studio",

            whatsapp_negocio:
              "62988887777",

            areas: [
              "Unhas",
              "Cabelo",
            ],
          }
        );

        expect(
          resposta.body
        ).toMatchObject({
          mensagem:
            "Configurações salvas com sucesso.",

          negocio: {
            id:
              11,

            nome:
              "Studio Victor Premium",

            whatsapp:
              "62988887777",

            whatsapp_negocio:
              "62988887777",

            areas: [
              "Unhas",
              "Cabelo",
            ],

            papel:
              "dono",
          },
        });
      }
    );

    test(
      "aceita o campo whatsapp do novo contrato",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            criarNegocio()
          );

        configuracoesRepository
          .atualizarNegocio
          .mockResolvedValue(
            criarNegocio({
              whatsapp:
                "62977776666",

              whatsapp_negocio:
                "62977776666",
            })
          );

        const resposta =
          await request(app)
            .put(
              "/configuracoes"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              whatsapp:
                "(62) 97777-6666",
            });

        expect(
          resposta.status
        ).toBe(200);

        expect(
          configuracoesRepository
            .atualizarNegocio
        ).toHaveBeenCalledWith(
          11,
          expect.objectContaining({
            whatsapp_negocio:
              "62977776666",
          })
        );
      }
    );

    test(
      "preserva campos que não foram enviados",
      async () => {
        const negocioAtual =
          criarNegocio();

        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            negocioAtual
          );

        configuracoesRepository
          .atualizarNegocio
          .mockImplementation(
            async (
              negocioId,
              dados
            ) => ({
              ...negocioAtual,
              ...dados,

              id:
                negocioId,

              whatsapp:
                dados.whatsapp_negocio,
            })
          );

        const resposta =
          await request(app)
            .put(
              "/configuracoes"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              nome:
                "Novo nome",
            });

        expect(
          resposta.status
        ).toBe(200);

        expect(
          configuracoesRepository
            .atualizarNegocio
        ).toHaveBeenCalledWith(
          11,
          expect.objectContaining({
            nome:
              "Novo nome",

            foto_url:
              negocioAtual.foto_url,

            descricao:
              negocioAtual.descricao,

            setor:
              negocioAtual.setor,

            cidade:
              negocioAtual.cidade,

            bairro:
              negocioAtual.bairro,

            whatsapp_negocio:
              negocioAtual.whatsapp,

            areas:
              negocioAtual.areas,
          })
        );
      }
    );

    test(
      "impede profissional de editar o negócio",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo({
              papel:
                "profissional",
            })
          );

        const resposta =
          await request(app)
            .put(
              "/configuracoes"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              nome:
                "Alteração indevida",
            });

        expect(
          resposta.status
        ).toBe(403);

        expect(
          resposta.body.erro
        ).toBe(
          "Apenas o dono pode editar o negócio."
        );

        expect(
          configuracoesRepository
            .buscarNegocioPorId
        ).not.toHaveBeenCalled();

        expect(
          configuracoesRepository
            .atualizarNegocio
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 400 para nome inválido",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            criarNegocio()
          );

        const resposta =
          await request(app)
            .put(
              "/configuracoes"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              nome:
                "A",
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Nome do negócio deve ter pelo menos 2 caracteres."
        );

        expect(
          configuracoesRepository
            .atualizarNegocio
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 400 para WhatsApp inválido",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            criarNegocio()
          );

        const resposta =
          await request(app)
            .put(
              "/configuracoes"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              whatsapp:
                "123",
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Digite um WhatsApp válido com DDD."
        );

        expect(
          configuracoesRepository
            .atualizarNegocio
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 400 para link de localização inválido",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            criarNegocio()
          );

        const resposta =
          await request(app)
            .put(
              "/configuracoes"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              localizacao_url:
                "maps sem protocolo",
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Digite um link de localização válido."
        );

        expect(
          configuracoesRepository
            .atualizarNegocio
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 400 quando são enviadas mais de 30 áreas",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            criarNegocio()
          );

        const areas =
          Array.from(
            {
              length:
                31,
            },

            (
              _,
              indice
            ) =>
              `Área ${indice + 1}`
          );

        const resposta =
          await request(app)
            .put(
              "/configuracoes"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              areas,
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Informe no máximo 30 áreas atendidas."
        );

        expect(
          configuracoesRepository
            .atualizarNegocio
        ).not.toHaveBeenCalled();
      }
    );
  }
);