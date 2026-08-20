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
  "bcrypt",
  () => ({
    compare:
      jest.fn(),

    hash:
      jest.fn(),
  })
);

jest.mock(
  "../src/repositories/contaRepository",
  () => ({
    buscarUsuarioPorId:
      jest.fn(),

    buscarSenhaUsuario:
      jest.fn(),

    atualizarUsuario:
      jest.fn(),

    atualizarPreferenciaWhatsapp:
      jest.fn(),

    atualizarNotificacoesWhatsapp:
      jest.fn(),

    atualizarSenha:
      jest.fn(),

    atualizarFotoUsuario:
      jest.fn(),
  })
);

jest.mock(
  "../src/utils/uploadCloudinary",
  () => jest.fn()
);

/*
 * Substitui o Multer durante os testes.
 *
 * O header x-test-file simula uma imagem.
 * O header x-test-upload-error simula
 * o limite de tamanho excedido.
 */
jest.mock(
  "../src/middlewares/upload",
  () => ({
    single:
      jest.fn(
        () =>
          (
            req,
            res,
            next
          ) => {
            if (
              req.headers[
                "x-test-upload-error"
              ] === "limit"
            ) {
              const erro =
                new Error(
                  "Arquivo muito grande."
                );

              erro.name =
                "MulterError";

              erro.code =
                "LIMIT_FILE_SIZE";

              return next(
                erro
              );
            }

            if (
              req.headers[
                "x-test-file"
              ] === "valid"
            ) {
              req.file = {
                originalname:
                  "foto.png",

                mimetype:
                  "image/png",

                size:
                  6,

                buffer:
                  Buffer.from(
                    "imagem"
                  ),
              };
            }

            return next();
          }
      ),
  })
);

const bcrypt = require(
  "bcrypt"
);

const contaRepository = require(
  "../src/repositories/contaRepository"
);

const uploadToCloudinary = require(
  "../src/utils/uploadCloudinary"
);

const contaRoutes = require(
  "../src/routes/contaRoutes"
);

function criarApp() {
  const app =
    express();

  app.use(
    express.json()
  );

  app.use(
    contaRoutes
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

function criarUsuario(
  alteracoes = {}
) {
  return {
    id: 7,

    nome:
      "Victor Souza",

    email:
      "victor@email.com",

    whatsapp:
      "62999999999",

    foto_url:
      null,

    foto_public_id:
      null,

    ativo:
      true,

    email_verificado_em:
      null,

    ultimo_login_em:
      "2026-07-16T20:00:00.000Z",

    senha_alterada_em:
      null,

    created_at:
      "2026-07-16T18:00:00.000Z",

    updated_at:
      "2026-07-16T20:00:00.000Z",

    ...alteracoes,
  };
}

describe(
  "Rotas da conta",
  () => {
    let app;

    beforeEach(() => {
      app =
        criarApp();

      jest.clearAllMocks();

      uploadToCloudinary
        .remover =
        jest.fn()
          .mockResolvedValue({
            result:
              "ok",
          });
    });

    test(
      "retorna 401 quando o token não é enviado",
      async () => {
        const resposta =
          await request(app)
            .get(
              "/conta"
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
          contaRepository
            .buscarUsuarioPorId
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna os dados seguros da conta com JWT contendo somente id",
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

        contaRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            criarUsuario()
          );

        const resposta =
          await request(app)
            .get(
              "/conta"
            )
            .set(
              "Authorization",
              `Bearer ${token}`
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          contaRepository
            .buscarUsuarioPorId
        ).toHaveBeenCalledWith(
          7
        );

        expect(
          resposta.body
        ).toEqual({
          usuario:
            expect.objectContaining({
              id: 7,

              nome:
                "Victor Souza",

              email:
                "victor@email.com",

              whatsapp:
                "62999999999",

              ativo:
                true,
            }),
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
      "retorna 404 quando o usuário não existe",
      async () => {
        contaRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            null
          );

        const resposta =
          await request(app)
            .get(
              "/conta"
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
          "Usuário não encontrado."
        );
      }
    );

    test(
      "ativa os lembretes diários com consentimento explícito",
      async () => {
        contaRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            criarUsuario()
          );

        contaRepository
          .atualizarPreferenciaWhatsapp
          .mockResolvedValue({
            id: 7,
            aceita_lembretes_whatsapp: true,
          });

        const resposta = await request(app)
          .put("/conta/preferencias-whatsapp")
          .set(
            "Authorization",
            `Bearer ${gerarToken()}`
          )
          .send({
            aceitaLembretes: true,
          });

        expect(resposta.status).toBe(200);
        expect(
          contaRepository
            .atualizarPreferenciaWhatsapp
        ).toHaveBeenCalledWith({
          usuarioId: 7,
          aceitaLembretes: true,
        });
        expect(resposta.body.mensagem).toBe(
          "Lembretes diários do WhatsApp ativados."
        );
      }
    );

    test(
      "permite desativar as mensagens de agendamento do WhatsApp",
      async () => {
        contaRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            criarUsuario({
              aceita_notificacoes_whatsapp: true,
            })
          );

        contaRepository
          .atualizarNotificacoesWhatsapp
          .mockResolvedValue({
            id: 7,
            aceita_notificacoes_whatsapp: false,
          });

        const resposta = await request(app)
          .put("/conta/notificacoes-whatsapp")
          .set(
            "Authorization",
            `Bearer ${gerarToken()}`
          )
          .send({
            aceitaNotificacoes: false,
          });

        expect(resposta.status).toBe(200);
        expect(
          contaRepository
            .atualizarNotificacoesWhatsapp
        ).toHaveBeenCalledWith({
          usuarioId: 7,
          aceitaNotificacoes: false,
        });
        expect(resposta.body.mensagem).toBe(
          "Mensagens dos agendamentos pelo WhatsApp desativadas."
        );
      }
    );

    test(
      "atualiza nome e WhatsApp normalizados",
      async () => {
        contaRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            criarUsuario()
          );

        contaRepository
          .atualizarUsuario
          .mockResolvedValue(
            criarUsuario({
              nome:
                "Victor Souza",

              whatsapp:
                "62999999999",
            })
          );

        const resposta =
          await request(app)
            .put(
              "/conta"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              nome:
                "  Victor    Souza  ",

              whatsapp:
                "(62) 99999-9999",
            });

        expect(
          resposta.status
        ).toBe(200);

        expect(
          contaRepository
            .buscarUsuarioPorId
        ).toHaveBeenCalledWith(
          7
        );

        expect(
          contaRepository
            .atualizarUsuario
        ).toHaveBeenCalledWith({
          usuarioId:
            7,

          nome:
            "Victor Souza",

          whatsapp:
            "62999999999",
        });

        expect(
          resposta.body
        ).toMatchObject({
          mensagem:
            "Conta atualizada com sucesso.",

          usuario: {
            id: 7,

            nome:
              "Victor Souza",

            whatsapp:
              "62999999999",
          },
        });
      }
    );

    test.each([
      [
        {
          nome:
            "A",

          whatsapp:
            "62999999999",
        },

        "Digite um nome válido.",
      ],

      [
        {
          nome:
            "Victor Souza",

          whatsapp:
            "123",
        },

        "Digite um WhatsApp válido com DDD.",
      ],
    ])(
      "retorna 400 para dados inválidos da conta",
      async (
        dados,
        mensagem
      ) => {
        const resposta =
          await request(app)
            .put(
              "/conta"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send(
              dados
            );

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          mensagem
        );

        expect(
          contaRepository
            .atualizarUsuario
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 403 quando a conta está desativada",
      async () => {
        contaRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            criarUsuario({
              ativo:
                false,
            })
          );

        const resposta =
          await request(app)
            .put(
              "/conta"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              nome:
                "Victor Souza",

              whatsapp:
                "62999999999",
            });

        expect(
          resposta.status
        ).toBe(403);

        expect(
          resposta.body.erro
        ).toBe(
          "Esta conta está desativada."
        );

        expect(
          contaRepository
            .atualizarUsuario
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "altera a senha e atualiza senha_alterada_em",
      async () => {
        contaRepository
          .buscarSenhaUsuario
          .mockResolvedValue({
            id: 7,

            senha:
              "hash-antigo",

            ativo:
              true,

            senha_alterada_em:
              null,
          });

        bcrypt.compare
          .mockResolvedValueOnce(
            true
          )
          .mockResolvedValueOnce(
            false
          );

        bcrypt.hash
          .mockResolvedValue(
            "hash-novo"
          );

        contaRepository
          .atualizarSenha
          .mockResolvedValue({
            id: 7,

            senha_alterada_em:
              "2026-07-16T22:00:00.000Z",

            updated_at:
              "2026-07-16T22:00:00.000Z",
          });

        const resposta =
          await request(app)
            .put(
              "/conta/senha"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              senhaAtual:
                "SenhaAntiga@123",

              novaSenha:
                "NovaSenha@123",
            });

        expect(
          resposta.status
        ).toBe(200);

        expect(
          bcrypt.compare
        ).toHaveBeenNthCalledWith(
          1,
          "SenhaAntiga@123",
          "hash-antigo"
        );

        expect(
          bcrypt.compare
        ).toHaveBeenNthCalledWith(
          2,
          "NovaSenha@123",
          "hash-antigo"
        );

        expect(
          bcrypt.hash
        ).toHaveBeenCalledWith(
          "NovaSenha@123",
          10
        );

        expect(
          contaRepository
            .atualizarSenha
        ).toHaveBeenCalledWith({
          usuarioId:
            7,

          senhaHash:
            "hash-novo",
        });

        expect(
          resposta.body
        ).toEqual({
          mensagem:
            "Senha alterada com sucesso.",

          senha_alterada_em:
            "2026-07-16T22:00:00.000Z",
        });
      }
    );

    test(
      "retorna 400 quando a senha atual está incorreta",
      async () => {
        contaRepository
          .buscarSenhaUsuario
          .mockResolvedValue({
            id: 7,

            senha:
              "hash-antigo",

            ativo:
              true,
          });

        bcrypt.compare
          .mockResolvedValue(
            false
          );

        const resposta =
          await request(app)
            .put(
              "/conta/senha"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              senhaAtual:
                "SenhaErrada",

              novaSenha:
                "NovaSenha@123",
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Senha atual incorreta."
        );

        expect(
          bcrypt.hash
        ).not.toHaveBeenCalled();

        expect(
          contaRepository
            .atualizarSenha
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "impede usar a mesma senha novamente",
      async () => {
        contaRepository
          .buscarSenhaUsuario
          .mockResolvedValue({
            id: 7,

            senha:
              "hash-atual",

            ativo:
              true,
          });

        bcrypt.compare
          .mockResolvedValueOnce(
            true
          )
          .mockResolvedValueOnce(
            true
          );

        const resposta =
          await request(app)
            .put(
              "/conta/senha"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              senhaAtual:
                "SenhaAtual@123",

              novaSenha:
                "SenhaAtual@123",
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "A nova senha deve ser diferente da senha atual."
        );

        expect(
          bcrypt.hash
        ).not.toHaveBeenCalled();

        expect(
          contaRepository
            .atualizarSenha
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "rejeita nova senha Unicode acima de 72 bytes",
      async () => {
        const resposta =
          await request(app)
            .put(
              "/conta/senha"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .send({
              senhaAtual:
                "SenhaAtual@123",

              novaSenha:
                "😀".repeat(19),
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "A nova senha deve ter entre 8 e 72 bytes."
        );

        expect(
          contaRepository
            .buscarSenhaUsuario
        ).not.toHaveBeenCalled();

        expect(
          bcrypt.hash
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 400 quando nenhuma foto é enviada",
      async () => {
        const resposta =
          await request(app)
            .post(
              "/conta/foto"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            );

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Nenhuma imagem enviada."
        );

        expect(
          uploadToCloudinary
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "envia e salva uma foto de perfil válida",
      async () => {
        contaRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            criarUsuario()
          );

        uploadToCloudinary
          .mockResolvedValue({
            secure_url:
              "https://cdn.teste/foto.png",

            public_id:
              "usuarios/foto-7",
          });

        contaRepository
          .atualizarFotoUsuario
          .mockResolvedValue(
            criarUsuario({
              foto_url:
                "https://cdn.teste/foto.png",

              foto_public_id:
                "usuarios/foto-7",
            })
          );

        const resposta =
          await request(app)
            .post(
              "/conta/foto"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .set(
              "x-test-file",
              "valid"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          uploadToCloudinary
        ).toHaveBeenCalledWith(
          expect.any(
            Buffer
          ),
          "saas-agendamento/usuarios"
        );

        expect(
          contaRepository
            .atualizarFotoUsuario
        ).toHaveBeenCalledWith({
          usuarioId:
            7,

          fotoUrl:
            "https://cdn.teste/foto.png",

          fotoPublicId:
            "usuarios/foto-7",
        });

        expect(
          resposta.body
        ).toMatchObject({
          mensagem:
            "Foto atualizada com sucesso.",

          foto:
            "https://cdn.teste/foto.png",

          usuario: {
            id: 7,

            foto_url:
              "https://cdn.teste/foto.png",
          },
        });
      }
    );

    test(
      "retorna 413 quando a foto ultrapassa o limite",
      async () => {
        const resposta =
          await request(app)
            .post(
              "/conta/foto"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .set(
              "x-test-upload-error",
              "limit"
            );

        expect(
          resposta.status
        ).toBe(413);

        expect(
          resposta.body.erro
        ).toBe(
          "A imagem deve ter no máximo 5 MB."
        );

        expect(
          uploadToCloudinary
        ).not.toHaveBeenCalled();

        expect(
          contaRepository
            .atualizarFotoUsuario
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "remove a foto antiga após substituir com sucesso",
      async () => {
        contaRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            criarUsuario({
              foto_public_id:
                "usuarios/foto-antiga",
            })
          );

        uploadToCloudinary
          .mockResolvedValue({
            secure_url:
              "https://cdn.teste/foto-nova.png",
            public_id:
              "usuarios/foto-nova",
          });

        contaRepository
          .atualizarFotoUsuario
          .mockResolvedValue(
            criarUsuario({
              foto_url:
                "https://cdn.teste/foto-nova.png",
              foto_public_id:
                "usuarios/foto-nova",
            })
          );

        const resposta =
          await request(app)
            .post(
              "/conta/foto"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .set(
              "x-test-file",
              "valid"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          uploadToCloudinary
            .remover
        ).toHaveBeenCalledWith(
          "usuarios/foto-antiga"
        );
      }
    );

    test(
      "remove o upload novo quando o banco falha",
      async () => {
        contaRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            criarUsuario()
          );

        uploadToCloudinary
          .mockResolvedValue({
            secure_url:
              "https://cdn.teste/foto-nova.png",
            public_id:
              "usuarios/foto-nova",
          });

        contaRepository
          .atualizarFotoUsuario
          .mockRejectedValue(
            new Error(
              "Banco indisponível"
            )
          );

        const resposta =
          await request(app)
            .post(
              "/conta/foto"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .set(
              "x-test-file",
              "valid"
            );

        expect(
          resposta.status
        ).toBe(500);

        expect(
          uploadToCloudinary
            .remover
        ).toHaveBeenCalledWith(
          "usuarios/foto-nova"
        );
      }
    );

    test(
      "retorna 502 quando o provedor de imagens falha",
      async () => {
        contaRepository
          .buscarUsuarioPorId
          .mockResolvedValue(
            criarUsuario()
          );

        uploadToCloudinary
          .mockRejectedValue(
            new Error(
              "Cloudinary indisponível"
            )
          );

        const resposta =
          await request(app)
            .post(
              "/conta/foto"
            )
            .set(
              "Authorization",
              `Bearer ${gerarToken()}`
            )
            .set(
              "x-test-file",
              "valid"
            );

        expect(
          resposta.status
        ).toBe(502);

        expect(
          resposta.body.erro
        ).toBe(
          "Não foi possível enviar a foto agora."
        );

        expect(
          contaRepository
            .atualizarFotoUsuario
        ).not.toHaveBeenCalled();
      }
    );
  }
);
