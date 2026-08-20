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
  "segredo-seguro-exclusivo-dos-testes";
process.env.JWT_EXPIRES_IN =
  "1h";
process.env.GOOGLE_CLIENT_ID =
  "cliente.apps.googleusercontent.com";

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock(
  "../src/services/googleIdentityService",
  () => ({
    verificarCredencial:
      jest.fn(),
    obterConfiguracaoPublica:
      jest.fn(() => ({
        googleClientId:
          process.env
            .GOOGLE_CLIENT_ID,
      })),
  })
);

jest.mock(
  "../src/repositories/authRepository",
  () => ({
    buscarUsuarioPorEmail:
      jest.fn(),
    buscarUsuarioPorGoogleSub:
      jest.fn(),
    buscarUsuarioPorId:
      jest.fn(),
    criarUsuario: jest.fn(),
    criarUsuarioGoogle:
      jest.fn(),
    vincularUsuarioAoGoogle:
      jest.fn(),
    atualizarUltimoLogin:
      jest.fn(),
    atualizarSenha: jest.fn(),
    desativarUsuario:
      jest.fn(),
  })
);

const googleIdentityService =
  require(
    "../src/services/googleIdentityService"
  );

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
  app.use(
    (erro, _req, res, _next) => {
      return res
        .status(
          erro.statusCode ||
            erro.status ||
            500
        )
        .json({
          erro:
            erro.message ||
            "Erro interno do servidor.",
        });
    }
  );

  return app;
}

function criarUsuario(
  alteracoes = {}
) {
  return {
    id: 7,
    nome: "Victor Souza",
    email:
      "victor@gmail.com",
    senha: null,
    whatsapp: null,
    google_sub:
      "google-sub-123",
    ativo: true,
    email_verificado_em:
      "2026-07-29T08:00:00.000Z",
    ultimo_login_em: null,
    senha_alterada_em:
      null,
    created_at:
      "2026-07-29T08:00:00.000Z",
    updated_at:
      "2026-07-29T08:00:00.000Z",
    ...alteracoes,
  };
}

describe(
  "Autenticação Google",
  () => {
    let app;

    beforeEach(() => {
      app = criarApp();
      jest.clearAllMocks();

      googleIdentityService
        .verificarCredencial
        .mockResolvedValue({
          googleSub:
            "google-sub-123",
          nome:
            "Victor Souza",
          email:
            "victor@gmail.com",
          emailAutoritativo:
            true,
        });

      authRepository
        .atualizarUltimoLogin
        .mockResolvedValue({
          ultimo_login_em:
            "2026-07-29T09:00:00.000Z",
        });
    });

    test(
      "expõe somente o client ID público",
      async () => {
        const resposta =
          await request(app).get(
            "/auth/configuracao-publica"
          );

        expect(
          resposta.status
        ).toBe(200);
        expect(
          resposta.body
        ).toEqual({
          googleClientId:
            process.env
              .GOOGLE_CLIENT_ID,
        });
      }
    );

    test(
      "cria conta quando o Google sub e o e-mail ainda não existem",
      async () => {
        authRepository
          .buscarUsuarioPorGoogleSub
          .mockResolvedValue(null);
        authRepository
          .buscarUsuarioPorEmail
          .mockResolvedValue(null);
        authRepository
          .criarUsuarioGoogle
          .mockResolvedValue(
            criarUsuario()
          );

        const resposta =
          await request(app)
            .post("/auth/google")
            .send({
              credential:
                "id-token-google",
            });

        expect(
          resposta.status
        ).toBe(200);
        expect(
          googleIdentityService
            .verificarCredencial
        ).toHaveBeenCalledWith(
          "id-token-google"
        );
        expect(
          authRepository
            .criarUsuarioGoogle
        ).toHaveBeenCalledWith({
          googleSub:
            "google-sub-123",
          nome:
            "Victor Souza",
          email:
            "victor@gmail.com",
          emailAutoritativo:
            true,
          aceitaNotificacoesWhatsapp:
            false,
        });
        expect(
          resposta.body
            .contaCriada
        ).toBe(true);
        expect(
          resposta.body.usuario
        ).toMatchObject({
          id: 7,
          email:
            "victor@gmail.com",
          googleConectado: true,
        });
        expect(
          resposta.body.usuario
        ).not.toHaveProperty(
          "google_sub"
        );
        expect(
          jwt.verify(
            resposta.body.token,
            process.env
              .JWT_SECRET
          ).id
        ).toBe(7);
      }
    );

    test(
      "autentica conta já vinculada pelo Google sub",
      async () => {
        authRepository
          .buscarUsuarioPorGoogleSub
          .mockResolvedValue(
            criarUsuario()
          );

        const resposta =
          await request(app)
            .post("/auth/google")
            .send({
              credential:
                "id-token-google",
            });

        expect(
          resposta.status
        ).toBe(200);
        expect(
          resposta.body
            .contaCriada
        ).toBe(false);
        expect(
          authRepository
            .buscarUsuarioPorEmail
        ).not.toHaveBeenCalled();
        expect(
          authRepository
            .criarUsuarioGoogle
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "vincula conta tradicional com o mesmo e-mail verificado",
      async () => {
        authRepository
          .buscarUsuarioPorGoogleSub
          .mockResolvedValue(null);
        authRepository
          .buscarUsuarioPorEmail
          .mockResolvedValue(
            criarUsuario({
              senha:
                "$2b$10$hash",
              whatsapp:
                "62999999999",
              google_sub: null,
            })
          );
        authRepository
          .vincularUsuarioAoGoogle
          .mockResolvedValue(
            criarUsuario({
              senha:
                "$2b$10$hash",
              whatsapp:
                "62999999999",
            })
          );

        const resposta =
          await request(app)
            .post("/auth/google")
            .send({
              credential:
                "id-token-google",
            });

        expect(
          resposta.status
        ).toBe(200);
        expect(
          authRepository
            .vincularUsuarioAoGoogle
        ).toHaveBeenCalledWith({
          usuarioId: 7,
          googleSub:
            "google-sub-123",
        });
        expect(
          resposta.body
            .contaCriada
        ).toBe(false);
      }
    );

    test(
      "bloqueia conta desativada",
      async () => {
        authRepository
          .buscarUsuarioPorGoogleSub
          .mockResolvedValue(
            criarUsuario({
              ativo: false,
            })
          );

        const resposta =
          await request(app)
            .post("/auth/google")
            .send({
              credential:
                "id-token-google",
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
          authRepository
            .atualizarUltimoLogin
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "rejeita e-mail já ligado a outro Google sub",
      async () => {
        authRepository
          .buscarUsuarioPorGoogleSub
          .mockResolvedValue(null);
        authRepository
          .buscarUsuarioPorEmail
          .mockResolvedValue(
            criarUsuario({
              google_sub:
                "outro-sub",
            })
          );

        const resposta =
          await request(app)
            .post("/auth/google")
            .send({
              credential:
                "id-token-google",
            });

        expect(
          resposta.status
        ).toBe(409);
        expect(
          resposta.body.erro
        ).toBe(
          "Este e-mail já está vinculado a outra conta Google."
        );
      }
    );

    test(
      "não vincula automaticamente e-mail de domínio externo",
      async () => {
        googleIdentityService
          .verificarCredencial
          .mockResolvedValue({
            googleSub:
              "google-sub-123",
            nome:
              "Victor Souza",
            email:
              "victor@empresa.com",
            emailAutoritativo:
              false,
          });
        authRepository
          .buscarUsuarioPorGoogleSub
          .mockResolvedValue(null);
        authRepository
          .buscarUsuarioPorEmail
          .mockResolvedValue(
            criarUsuario({
              email:
                "victor@empresa.com",
              google_sub: null,
              senha:
                "$2b$10$hash",
            })
          );

        const resposta =
          await request(app)
            .post("/auth/google")
            .send({
              credential:
                "id-token-google",
            });

        expect(
          resposta.status
        ).toBe(409);
        expect(
          resposta.body.erro
        ).toBe(
          "Entre com sua senha para vincular este e-mail à conta Google."
        );
        expect(
          authRepository
            .vincularUsuarioAoGoogle
        ).not.toHaveBeenCalled();
      }
    );
  }
);
