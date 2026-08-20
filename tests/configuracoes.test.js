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

    atualizarFotoNegocio:
      jest.fn(),

    atualizarPublicacao:
      jest.fn(),
  })
);

jest.mock(
  "../src/utils/uploadCloudinary",
  () => {
    const enviar = jest.fn();
    enviar.remover = jest.fn();
    return enviar;
  }
);

const configuracoesRepository =
  require(
    "../src/repositories/configuracoesRepository"
  );

const uploadToCloudinary = require(
  "../src/utils/uploadCloudinary"
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

    publicado:
      false,

    cidade:
      "Goiânia",

    estado:
      "GO",

    bairro:
      "Centro",

    endereco:
      "Rua das Flores",

    numero:
      "10",

    complemento:
      "Sala 2",

    cep:
      "74000123",

    localizacao_url:
      "https://maps.google.com/",

    whatsapp:
      "62999999999",

    whatsapp_negocio:
      "62999999999",

    areas: [
      "Unhas",
      "Cabelos",
    ],

    possui_servico_ativo:
      true,

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
            "Cabelos",
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

              estado:
                "SP",

              bairro:
                "Setor Central",

              endereco:
                "Avenida Brasil",

              numero:
                "123",

              complemento:
                "Sala 4",

              cep:
                "01001000",

              localizacao_url:
                "https://maps.google.com/?q=studio",

              whatsapp:
                "62988887777",

              whatsapp_negocio:
                "62988887777",

              areas: [
                "Unhas",
                "Cabelos",
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

              estado:
                "sp",

              bairro:
                "  Setor   Central  ",

              endereco:
                "  Avenida   Brasil  ",

              numero:
                " 123 ",

              complemento:
                " Sala 4 ",

              cep:
                "01001-000",

              localizacao_url:
                "https://maps.google.com/?q=studio",

              whatsapp_negocio:
                "+55 (62) 98888-7777",

              areas:
                JSON.stringify([
                  "Unhas",
                  " Cabelos ",
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

            slug:
              "studio-victor-premium",

            foto_url:
              "https://cdn.teste/studio.png",

            descricao:
              "Beleza e estética.",

            setor:
              "Unhas",

            cidade:
              "Goiânia",

            estado:
              "SP",

            bairro:
              "Setor Central",

            endereco:
              "Avenida Brasil",

            numero:
              "123",

            complemento:
              "Sala 4",

            cep:
              "01001000",

            localizacao_url:
              "https://maps.google.com/?q=studio",

            whatsapp_negocio:
              "62988887777",

            areas: [
              "Unhas",
              "Cabelos",
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
              "Cabelos",
            ],

            papel:
              "dono",
          },
        });
      }
    );

    test(
      "atualiza o endereço público pelo nome e rejeita endereço ocupado",
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

        const erro = new Error(
          "Slug indisponível."
        );
        erro.code =
          "SLUG_INDISPONIVEL";

        configuracoesRepository
          .atualizarNegocio
          .mockRejectedValue(
            erro
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
                " Beauty Vanessa ",
            });

        expect(
          resposta.status
        ).toBe(409);

        expect(
          configuracoesRepository
            .atualizarNegocio
        ).toHaveBeenCalledWith(
          11,
          expect.objectContaining({
            slug:
              "beauty-vanessa",
          })
        );

        expect(
          resposta.body.erro
        ).toBe(
          "Já existe um negócio com um endereço igual ao gerado por esse nome. Diferencie o nome e tente novamente."
        );
      }
    );

    test(
      "preserva o endereço público quando o nome não mudou",
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
            criarNegocio()
          );

        const resposta =
          await request(app)
            .put("/configuracoes")
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              descricao:
                "Nova descrição",
              slug:
                "slug-enviado-nao-deve-ser-usado",
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
              "Studio Victor",
            slug:
              "studio-victor",
          })
        );
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
              "Unhas",

            cidade:
              negocioAtual.cidade,

            estado:
              negocioAtual.estado,

            bairro:
              negocioAtual.bairro,

            endereco:
              negocioAtual.endereco,

            numero:
              negocioAtual.numero,

            complemento:
              negocioAtual.complemento,

            cep:
              negocioAtual.cep,

            whatsapp_negocio:
              negocioAtual.whatsapp,

            areas:
              [
                "Unhas",
                "Cabelos",
              ],
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
      "publica um negócio do dono mesmo sem descrição",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            criarNegocio({
              descricao:
                "",
            })
          );

        configuracoesRepository
          .atualizarPublicacao
          .mockResolvedValue({
            id:
              11,

            publicado:
              true,
          });

        const resposta =
          await request(app)
            .patch(
              "/configuracoes/publicacao"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              publicado:
                true,
            });

        expect(
          resposta.status
        ).toBe(200);

        expect(
          configuracoesRepository
            .atualizarPublicacao
        ).toHaveBeenCalledWith(
          11,
          true
        );

        expect(
          resposta.body
        ).toMatchObject({
          mensagem:
            "Seu negócio está publicado e já pode aparecer na página inicial.",

          negocio: {
            publicado:
              true,
          },

          publicacao: {
            publicado:
              true,

            pode_publicar:
              true,

            pendencias: [],
          },
        });
      }
    );

    test(
      "impede publicar um perfil incompleto",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            criarNegocio({
              descricao:
                "",

              cidade:
                "",

              possui_servico_ativo:
                false,
            })
          );

        const resposta =
          await request(app)
            .patch(
              "/configuracoes/publicacao"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              publicado:
                true,
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Complete o perfil antes de publicar: cidade, pelo menos um serviço ativo."
        );

        expect(
          configuracoesRepository
            .atualizarPublicacao
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "exige estado válido antes de publicar",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            criarNegocio({
              estado:
                "",
            })
          );

        const resposta =
          await request(app)
            .patch(
              "/configuracoes/publicacao"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              publicado:
                true,
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Complete o perfil antes de publicar: estado."
        );

        expect(
          configuracoesRepository
            .atualizarPublicacao
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "exige ao menos uma especialidade antes de publicar",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            criarNegocio({
              setor:
                "",

              areas: [],
            })
          );

        const resposta =
          await request(app)
            .patch(
              "/configuracoes/publicacao"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              publicado:
                true,
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Complete o perfil antes de publicar: pelo menos uma especialidade."
        );

        expect(
          configuracoesRepository
            .atualizarPublicacao
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "permite ao dono retirar o negócio da página inicial",
      async () => {
        configuracoesRepository
          .buscarNegocioDoUsuario
          .mockResolvedValue(
            criarVinculo()
          );

        configuracoesRepository
          .buscarNegocioPorId
          .mockResolvedValue(
            criarNegocio({
              publicado:
                true,
            })
          );

        configuracoesRepository
          .atualizarPublicacao
          .mockResolvedValue({
            id:
              11,

            publicado:
              false,
          });

        const resposta =
          await request(app)
            .patch(
              "/configuracoes/publicacao"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              publicado:
                false,
            });

        expect(
          resposta.status
        ).toBe(200);

        expect(
          resposta.body.publicacao
            .publicado
        ).toBe(false);
      }
    );

    test(
      "impede profissional de alterar a publicação",
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
            .patch(
              "/configuracoes/publicacao"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              publicado:
                true,
            });

        expect(
          resposta.status
        ).toBe(403);

        expect(
          configuracoesRepository
            .atualizarPublicacao
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
      "retorna 400 quando é enviada uma especialidade fora do seletor",
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
              especialidades: [
                "Veterinária",
              ],
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Selecione apenas especialidades válidas."
        );

        expect(
          configuracoesRepository
            .atualizarNegocio
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "troca a foto do negócio e remove a imagem anterior",
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

        uploadToCloudinary
          .mockResolvedValue({
            secure_url:
              "https://cdn.teste/nova-foto.png",

            public_id:
              "negocios/nova-foto",
          });

        configuracoesRepository
          .atualizarFotoNegocio
          .mockResolvedValue({
            id:
              11,

            foto_url:
              "https://cdn.teste/nova-foto.png",

            foto_public_id:
              "negocios/nova-foto",
          });

        const resposta =
          await request(app)
            .post(
              "/configuracoes/foto"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .attach(
              "foto",
              Buffer.from([
                0x89, 0x50, 0x4e, 0x47,
                0x0d, 0x0a, 0x1a, 0x0a,
                0x00,
              ]),
              {
                filename:
                  "negocio.png",

                contentType:
                  "image/png",
              }
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          configuracoesRepository
            .atualizarFotoNegocio
        ).toHaveBeenCalledWith({
          negocioId:
            11,

          fotoUrl:
            "https://cdn.teste/nova-foto.png",

          fotoPublicId:
            "negocios/nova-foto",
        });

        expect(
          uploadToCloudinary.remover
        ).toHaveBeenCalledWith(
          "negocios/studio-11"
        );

        expect(
          resposta.body.negocio.foto_url
        ).toBe(
          "https://cdn.teste/nova-foto.png"
        );
      }
    );
  }
);
