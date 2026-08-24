const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET =
  "segredo-seguro-exclusivo-dos-testes";

process.env.JWT_EXPIRES_IN = "1h";
process.env.BCRYPT_ROUNDS = "10";

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock(
  "../src/repositories/authRepository",
  () => ({
    buscarUsuarioPorEmail: jest.fn(),
    buscarUsuarioPorId: jest.fn(),
    criarUsuario: jest.fn(),
    atualizarUltimoLogin: jest.fn(),
    atualizarSenha: jest.fn(),
    desativarUsuario: jest.fn(),
  })
);

const bcrypt = require("bcrypt");

const authRepository = require(
  "../src/repositories/authRepository"
);

const authRoutes = require(
  "../src/routes/authRoutes"
);

function criarApp() {
  const app = express();

  app.use(express.json());
  app.use(authRoutes);

  app.use((erro, req, res, next) => {
    const status =
      erro.statusCode ||
      erro.status ||
      500;

    return res.status(status).json({
      erro:
        erro.message ||
        "Erro interno do servidor.",
    });
  });

  return app;
}

function criarUsuario(
  alteracoes = {}
) {
  return {
    id: 1,
    nome: "Victor Souza",
    email: "victor@email.com",
    senha: "$2b$10$hashDaSenha",
    whatsapp: "62999999999",
    ativo: true,
    email_verificado_em: null,
    ultimo_login_em: null,
    senha_alterada_em:
      "2026-07-16T12:00:00.000Z",
    created_at:
      "2026-07-16T12:00:00.000Z",
    updated_at:
      "2026-07-16T12:00:00.000Z",
    ...alteracoes,
  };
}

describe("Autenticação com conta única", () => {
  let app;

  beforeEach(() => {
    app = criarApp();

    jest.clearAllMocks();

    bcrypt.hash.mockResolvedValue(
      "$2b$10$hashDaSenha"
    );

    bcrypt.compare.mockResolvedValue(
      true
    );
  });

  describe("POST /cadastro", () => {
    test(
      "cria uma conta, normaliza os dados e ignora tipo e papel enviados",
      async () => {
        authRepository
          .buscarUsuarioPorEmail
          .mockResolvedValue(null);

        authRepository
          .criarUsuario
          .mockResolvedValue(
            criarUsuario()
          );

        const resposta =
          await request(app)
            .post("/cadastro")
            .send({
              nome:
                "  Victor Souza  ",

              email:
                "  VICTOR@EMAIL.COM  ",

              whatsapp:
                "+55 (62) 99999-9999",

              senha:
                "senha123",

              tipo:
                "admin",

              papel:
                "dono",
            });

        expect(
          resposta.status
        ).toBe(201);

        expect(
          authRepository
            .buscarUsuarioPorEmail
        ).toHaveBeenCalledWith(
          "victor@email.com"
        );

        expect(
          bcrypt.hash
        ).toHaveBeenCalledWith(
          "senha123",
          10
        );

        expect(
          authRepository.criarUsuario
        ).toHaveBeenCalledWith({
          nome:
            "Victor Souza",

          email:
            "victor@email.com",

          senha:
            "$2b$10$hashDaSenha",

          whatsapp:
            "62999999999",

          aceitaNotificacoesWhatsapp:
            false,

          aceitaAlertasWhatsapp:
            false,

          aceitaLembretesWhatsapp:
            false,
        });

        expect(
          resposta.body.mensagem
        ).toBe(
          "Conta criada com sucesso."
        );

        expect(
          resposta.body.token
        ).toEqual(
          expect.any(String)
        );

        expect(
          resposta.headers[
            "cache-control"
          ]
        ).toBe("no-store");

        expect(
          resposta.headers[
            "set-cookie"
          ]
        ).toEqual(
          expect.arrayContaining([
            expect.stringMatching(
              /^af_session=.*HttpOnly.*SameSite=Lax/i
            ),
          ])
        );

        expect(
          resposta.body.usuario
        ).toMatchObject({
          id: 1,
          nome: "Victor Souza",
          email: "victor@email.com",
          whatsapp: "62999999999",
          ativo: true,
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

        expect(
          resposta.body.usuario
        ).not.toHaveProperty(
          "papel"
        );

        const tokenDecodificado =
          jwt.verify(
            resposta.body.token,
            process.env.JWT_SECRET
          );

        expect(
          tokenDecodificado.id
        ).toBe(1);

        expect(
          tokenDecodificado
        ).not.toHaveProperty(
          "tipo"
        );

        expect(
          tokenDecodificado
        ).not.toHaveProperty(
          "papel"
        );
      }
    );

    test(
      "registra o consentimento explícito para o lembrete diário",
      async () => {
        authRepository
          .buscarUsuarioPorEmail
          .mockResolvedValue(null);

        authRepository
          .criarUsuario
          .mockResolvedValue(
            criarUsuario()
          );

        const resposta = await request(app)
          .post("/cadastro")
          .send({
            nome: "Ana Souza",
            email: "ana@email.com",
            whatsapp: "62999998888",
            senha: "senha123",
            aceitaAlertasWhatsapp: true,
            aceitaLembretesWhatsapp: true,
          });

        expect(resposta.status).toBe(201);
        expect(
          authRepository.criarUsuario
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            aceitaAlertasWhatsapp: true,
            aceitaLembretesWhatsapp: true,
          })
        );
      }
    );

    test(
      "retorna 400 quando faltam campos obrigatórios",
      async () => {
        const resposta =
          await request(app)
            .post("/cadastro")
            .send({
              nome:
                "Victor Souza",

              email:
                "victor@email.com",
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Preencha todos os campos obrigatórios."
        );

        expect(
          authRepository
            .criarUsuario
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 400 para nome inválido",
      async () => {
        const resposta =
          await request(app)
            .post("/cadastro")
            .send({
              nome:
                "V",

              email:
                "victor@email.com",

              whatsapp:
                "62999999999",

              senha:
                "senha123",
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Digite um nome válido."
        );
      }
    );

    test(
      "retorna 400 para email inválido",
      async () => {
        const resposta =
          await request(app)
            .post("/cadastro")
            .send({
              nome:
                "Victor Souza",

              email:
                "email-invalido",

              whatsapp:
                "62999999999",

              senha:
                "senha123",
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Digite um email válido."
        );

        expect(
          authRepository
            .buscarUsuarioPorEmail
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 400 para WhatsApp inválido",
      async () => {
        const resposta =
          await request(app)
            .post("/cadastro")
            .send({
              nome:
                "Victor Souza",

              email:
                "victor@email.com",

              whatsapp:
                "12345",

              senha:
                "senha123",
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Digite um WhatsApp válido."
        );
      }
    );

    test(
      "retorna 400 para senha curta",
      async () => {
        const resposta =
          await request(app)
            .post("/cadastro")
            .send({
              nome:
                "Victor Souza",

              email:
                "victor@email.com",

              whatsapp:
                "62999999999",

              senha:
                "123",
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "A senha deve ter entre 8 e 72 bytes."
        );

        expect(
          bcrypt.hash
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 409 quando o email já está cadastrado",
      async () => {
        authRepository
          .buscarUsuarioPorEmail
          .mockResolvedValue(
            criarUsuario()
          );

        const resposta =
          await request(app)
            .post("/cadastro")
            .send({
              nome:
                "Victor Souza",

              email:
                "victor@email.com",

              whatsapp:
                "62999999999",

              senha:
                "senha123",
            });

        expect(
          resposta.status
        ).toBe(409);

        expect(
          resposta.body.erro
        ).toBe(
          "Email já cadastrado."
        );

        expect(
          bcrypt.hash
        ).not.toHaveBeenCalled();

        expect(
          authRepository
            .criarUsuario
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "converte violação de índice único em erro 409",
      async () => {
        authRepository
          .buscarUsuarioPorEmail
          .mockResolvedValue(null);

        const erroPostgres =
          new Error(
            "duplicate key"
          );

        erroPostgres.code =
          "23505";

        authRepository
          .criarUsuario
          .mockRejectedValue(
            erroPostgres
          );

        const resposta =
          await request(app)
            .post("/cadastro")
            .send({
              nome:
                "Victor Souza",

              email:
                "victor@email.com",

              whatsapp:
                "62999999999",

              senha:
                "senha123",
            });

        expect(
          resposta.status
        ).toBe(409);

        expect(
          resposta.body.erro
        ).toBe(
          "Email já cadastrado."
        );
      }
    );
  });

  describe("POST /login", () => {
    test(
      "autentica a conta e retorna um token contendo somente o ID",
      async () => {
        const usuario =
          criarUsuario();

        authRepository
          .buscarUsuarioPorEmail
          .mockResolvedValue(
            usuario
          );

        bcrypt.compare
          .mockResolvedValue(true);

        authRepository
          .atualizarUltimoLogin
          .mockResolvedValue({
            ultimo_login_em:
              "2026-07-16T18:00:00.000Z",
          });

        const resposta =
          await request(app)
            .post("/login")
            .send({
              email:
                "  VICTOR@EMAIL.COM  ",

              senha:
                "senha123",
            });

        expect(
          resposta.status
        ).toBe(200);

        expect(
          authRepository
            .buscarUsuarioPorEmail
        ).toHaveBeenCalledWith(
          "victor@email.com"
        );

        expect(
          bcrypt.compare
        ).toHaveBeenCalledWith(
          "senha123",
          usuario.senha
        );

        expect(
          authRepository
            .atualizarUltimoLogin
        ).toHaveBeenCalledWith(
          1
        );

        expect(
          resposta.body.usuario
        ).toMatchObject({
          id: 1,
          nome: "Victor Souza",
          email: "victor@email.com",
          whatsapp: "62999999999",
          ativo: true,
          ultimo_login_em:
            "2026-07-16T18:00:00.000Z",
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

        const tokenDecodificado =
          jwt.verify(
            resposta.body.token,
            process.env.JWT_SECRET
          );

        expect(
          tokenDecodificado.id
        ).toBe(1);

        expect(
          tokenDecodificado
        ).not.toHaveProperty(
          "tipo"
        );
      }
    );

    test(
      "retorna 400 quando email ou senha não são enviados",
      async () => {
        const resposta =
          await request(app)
            .post("/login")
            .send({
              email:
                "victor@email.com",
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Email e senha são obrigatórios."
        );
      }
    );

    test(
      "mantém login compatível com senha legada de 6 caracteres",
      async () => {
        const usuario =
          criarUsuario();

        authRepository
          .buscarUsuarioPorEmail
          .mockResolvedValue(
            usuario
          );

        bcrypt.compare
          .mockResolvedValue(true);

        authRepository
          .atualizarUltimoLogin
          .mockResolvedValue({
            ultimo_login_em:
              "2026-08-21T18:00:00.000Z",
          });

        const resposta =
          await request(app)
            .post("/login")
            .send({
              email:
                "victor@email.com",

              senha:
                "123456",
            });

        expect(
          resposta.status
        ).toBe(200);

        expect(
          bcrypt.compare
        ).toHaveBeenCalledWith(
          "123456",
          usuario.senha
        );
      }
    );

    test(
      "retorna 400 para email com formato inválido",
      async () => {
        const resposta =
          await request(app)
            .post("/login")
            .send({
              email:
                "email-invalido",

              senha:
                "senha123",
            });

        expect(
          resposta.status
        ).toBe(400);

        expect(
          resposta.body.erro
        ).toBe(
          "Digite um email válido."
        );

        expect(
          authRepository
            .buscarUsuarioPorEmail
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "não revela se o email não está cadastrado",
      async () => {
        authRepository
          .buscarUsuarioPorEmail
          .mockResolvedValue(null);

        const resposta =
          await request(app)
            .post("/login")
            .send({
              email:
                "naoexiste@email.com",

              senha:
                "senha123",
            });

        expect(
          resposta.status
        ).toBe(401);

        expect(
          resposta.body.erro
        ).toBe(
          "Email ou senha inválidos."
        );

        expect(
          bcrypt.compare
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 401 quando a senha está incorreta",
      async () => {
        authRepository
          .buscarUsuarioPorEmail
          .mockResolvedValue(
            criarUsuario()
          );

        bcrypt.compare
          .mockResolvedValue(false);

        const resposta =
          await request(app)
            .post("/login")
            .send({
              email:
                "victor@email.com",

              senha:
                "senha-errada",
            });

        expect(
          resposta.status
        ).toBe(401);

        expect(
          resposta.body.erro
        ).toBe(
          "Email ou senha inválidos."
        );

        expect(
          authRepository
            .atualizarUltimoLogin
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "retorna 403 quando a conta está desativada",
      async () => {
        authRepository
          .buscarUsuarioPorEmail
          .mockResolvedValue(
            criarUsuario({
              ativo:
                false,
            })
          );

        const resposta =
          await request(app)
            .post("/login")
            .send({
              email:
                "victor@email.com",

              senha:
                "senha123",
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
          bcrypt.compare
        ).not.toHaveBeenCalled();

        expect(
          authRepository
            .atualizarUltimoLogin
        ).not.toHaveBeenCalled();
      }
    );
  });

  describe("POST /logout", () => {
    test(
      "remove o cookie da sessão sem depender do token no navegador",
      async () => {
        const resposta =
          await request(app)
            .post("/logout");

        expect(
          resposta.status
        ).toBe(204);

        expect(
          resposta.headers[
            "cache-control"
          ]
        ).toBe("no-store");

        expect(
          resposta.headers[
            "set-cookie"
          ]
        ).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              "af_session=;"
            ),
          ])
        );
      }
    );
  });
});
