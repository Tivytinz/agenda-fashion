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
  "../src/repositories/negocioRepository",
  () => ({
    buscarNegocioPorSlug:
      jest.fn(),

    buscarNegocioDoDono:
      jest.fn(),

    criarNegocio:
      jest.fn(),

    criarVinculoDono:
      jest.fn(),

    criarNegocioComDono:
      jest.fn(),
  })
);

const negocioRepository = require(
  "../src/repositories/negocioRepository"
);

const negocioRoutes = require(
  "../src/routes/negocioRoutes"
);

function criarApp() {
  const app = express();

  app.use(
    express.json()
  );

  app.use(
    negocioRoutes
  );

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

function dadosNegocio(
  alteracoes = {}
) {
  return {
    nome:
      "Studio Victor",

    setor:
      "Salão de beleza",

    especialidades: [
      "Unhas",
      "Estética",
    ],

    whatsapp:
      "(62) 99999-9999",

    descricao:
      "Especializado em beleza e cuidados pessoais.",

    cidade:
      "Goiânia",

    estado:
      "go",

    bairro:
      "Centro",

    endereco:
      "Rua Principal",

    numero:
      "100",

    complemento:
      "Sala 2",

    cep:
      "74000-000",

    localizacao_url:
      "https://maps.google.com/?q=goiania",

    fuso_horario:
      "America/Sao_Paulo",

    ...alteracoes,
  };
}

function negocioCriado(
  alteracoes = {}
) {
  return {
    id: 5,
    nome:
      "Studio Victor",
    slug:
      "studio-victor",
    descricao:
      "Especializado em beleza e cuidados pessoais.",
    setor:
      "Salão de beleza",
    whatsapp:
      "62999999999",
    foto_url:
      null,
    foto_public_id:
      null,
    cidade:
      "Goiânia",
    estado:
      "GO",
    bairro:
      "Centro",
    endereco:
      "Rua Principal",
    numero:
      "100",
    complemento:
      "Sala 2",
    cep:
      "74000000",
    localizacao_url:
      "https://maps.google.com/?q=goiania",
    latitude:
      null,
    longitude:
      null,
    fuso_horario:
      "America/Sao_Paulo",
    ativo:
      true,
    publicado:
      false,
    papel:
      "dono",
    vinculo_id:
      10,
    vinculado_em:
      "2026-07-16T20:00:00.000Z",
    created_at:
      "2026-07-16T20:00:00.000Z",
    updated_at:
      "2026-07-16T20:00:00.000Z",
    ...alteracoes,
  };
}

describe(
  "Fluxo de criação de negócio",
  () => {
    let app;

    beforeEach(() => {
      app = criarApp();

      jest.clearAllMocks();

      negocioRepository
        .buscarNegocioDoDono
        .mockResolvedValue(
          null
        );

      negocioRepository
        .buscarNegocioPorSlug
        .mockResolvedValue(
          null
        );
    });

    test(
      "retorna 401 quando o token não é enviado",
      async () => {
        const resposta =
          await request(app)
            .post(
              "/criar-negocio"
            )
            .send(
              dadosNegocio()
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
          negocioRepository
            .criarNegocioComDono
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "cria o negócio e vincula a conta como dona",
      async () => {
        const negocio =
          negocioCriado();

        negocioRepository
          .criarNegocioComDono
          .mockResolvedValue({
            negocio,

            vinculo: {
              id: 10,
              usuario_id: 1,
              negocio_id: 5,
              papel: "dono",
              ativo: true,
              created_at:
                "2026-07-16T20:00:00.000Z",
              updated_at:
                "2026-07-16T20:00:00.000Z",
            },
          });

        const resposta =
          await request(app)
            .post(
              "/criar-negocio"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send(
              dadosNegocio()
            );

        expect(
          resposta.status
        ).toBe(201);

        expect(
          negocioRepository
            .buscarNegocioDoDono
        ).toHaveBeenCalledWith(
          1
        );

        expect(
          negocioRepository
            .buscarNegocioPorSlug
        ).toHaveBeenCalledWith(
          "studio-victor"
        );

        expect(
          negocioRepository
            .criarNegocioComDono
        ).toHaveBeenCalledWith({
          usuarioId:
            1,

          negocio:
            expect.objectContaining({
              nome:
                "Studio Victor",

              slug:
                "studio-victor",

              setor:
                "Unhas",

              areas: [
                "Unhas",
                "Estética",
              ],

              whatsapp:
                "62999999999",

              cidade:
                "Goiânia",

              estado:
                "GO",

              cep:
                "74000000",

              fuso_horario:
                "America/Sao_Paulo",

              foto_url:
                null,

              foto_public_id:
                null,
            }),
        });

        expect(
          resposta.body
        ).toMatchObject({
          mensagem:
            "Negócio criado com sucesso.",

          temNegocio:
            true,

          negocio: {
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
          },
        });
      }
    );

    test(
      "gera um slug alternativo quando o nome já está em uso",
      async () => {
        negocioRepository
          .buscarNegocioPorSlug
          .mockResolvedValueOnce({
            id: 2,
            slug:
              "studio-victor",
          })
          .mockResolvedValueOnce(
            null
          );

        negocioRepository
          .criarNegocioComDono
          .mockResolvedValue({
            negocio:
              negocioCriado({
                slug:
                  "studio-victor-2",
              }),

            vinculo: {
              id: 10,
              papel:
                "dono",
            },
          });

        const resposta =
          await request(app)
            .post(
              "/criar-negocio"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send(
              dadosNegocio()
            );

        expect(
          resposta.status
        ).toBe(201);

        expect(
          negocioRepository
            .buscarNegocioPorSlug
        ).toHaveBeenNthCalledWith(
          1,
          "studio-victor"
        );

        expect(
          negocioRepository
            .buscarNegocioPorSlug
        ).toHaveBeenNthCalledWith(
          2,
          "studio-victor-2"
        );

        expect(
          negocioRepository
            .criarNegocioComDono
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            usuarioId:
              1,

            negocio:
              expect.objectContaining({
                slug:
                  "studio-victor-2",
              }),
          })
        );

        expect(
          resposta.body
            .negocio
            .slug
        ).toBe(
          "studio-victor-2"
        );
      }
    );

    test(
      "retorna 409 quando a conta já possui um negócio",
      async () => {
        negocioRepository
          .buscarNegocioDoDono
          .mockResolvedValue(
            negocioCriado()
          );

        const resposta =
          await request(app)
            .post(
              "/criar-negocio"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send(
              dadosNegocio()
            );

        expect(
          resposta.status
        ).toBe(409);

        expect(
          resposta.body.erro
        ).toBe(
          "Esta conta já possui um negócio."
        );

        expect(
          negocioRepository
            .criarNegocioComDono
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 400 para nome inválido",
      async () => {
        const resposta =
          await request(app)
            .post(
              "/criar-negocio"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send(
              dadosNegocio({
                nome:
                  "A",
              })
            );

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Digite um nome de negócio válido."
        );

        expect(
          negocioRepository
            .criarNegocioComDono
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 400 para WhatsApp inválido",
      async () => {
        const resposta =
          await request(app)
            .post(
              "/criar-negocio"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send(
              dadosNegocio({
                whatsapp:
                  "12345",
              })
            );

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Digite um WhatsApp válido."
        );

        expect(
          negocioRepository
            .criarNegocioComDono
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 400 quando somente uma coordenada é enviada",
      async () => {
        const resposta =
          await request(app)
            .post(
              "/criar-negocio"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send(
              dadosNegocio({
                latitude:
                  -16.6869,

                longitude:
                  null,
              })
            );

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Latitude e longitude devem ser informadas juntas."
        );
      }
    );

    test(
      "bloqueia a entrada direta em um negócio",
      async () => {
        const resposta =
          await request(app)
            .post(
              "/entrar-negocio"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              negocio_id:
                5,
            });

        expect(
          resposta.status
        ).toBe(403);

        expect(
          resposta.body.erro
        ).toBe(
          "Não é permitido entrar diretamente em um negócio. É necessário receber um convite."
        );
      }
    );
  }
);
