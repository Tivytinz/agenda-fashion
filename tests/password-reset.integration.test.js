jest.setTimeout(30000);

process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "password-reset-integration-secret-with-at-least-32-characters";
process.env.PUBLIC_APP_URL =
  "https://app.agendafashion.com.br";
process.env.BCRYPT_ROUNDS = "10";

jest.mock("../src/providers/emailProvider", () => ({
  enviarRedefinicaoSenha: jest.fn(),
}));

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const request = require("supertest");

const emailProvider = require(
  "../src/providers/emailProvider"
);
const app = require("../src/server");
const db = require("../src/db/db");

function sufixoUnico() {
  return `${Date.now()}${Math.floor(
    Math.random() * 100000
  )}`;
}

describe("CA-AUT-04 - recuperação de senha ponta a ponta", () => {
  let usuario;
  const senhaAntiga =
    "senha-antiga-segura";
  const senhaNova =
    "senha-nova-segura";

  beforeAll(async () => {
    const sufixo =
      sufixoUnico();
    const senhaHash =
      await bcrypt.hash(
        senhaAntiga,
        10
      );

    const resultado =
      await db.query(
        `
          INSERT INTO usuarios (
            nome,
            email,
            senha,
            whatsapp
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id, email
        `,
        [
          "Cliente Recuperação",
          `recuperacao.${sufixo}@teste.local`,
          senhaHash,
          "62999998888",
        ]
      );

    usuario = resultado.rows[0];
  });

  afterAll(async () => {
    try {
      if (usuario?.id) {
        await db.query(
          "DELETE FROM usuarios WHERE id = $1",
          [usuario.id]
        );
      }
    } finally {
      await db.end();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    emailProvider
      .enviarRedefinicaoSenha
      .mockResolvedValue({
        id: "email-reset-test",
      });
  });

  test("token verificado troca a senha, não vaza na query e só pode ser usado uma vez", async () => {
    const solicitacao =
      await request(app)
        .post(
          "/auth/esqueci-senha"
        )
        .send({
          email:
            usuario.email,
        });

    expect(
      solicitacao.statusCode
    ).toBe(200);
    expect(
      solicitacao.body.mensagem
    ).toMatch(
      /Se o e-mail estiver cadastrado/i
    );

    expect(
      emailProvider
        .enviarRedefinicaoSenha
    ).toHaveBeenCalledTimes(1);

    const envio =
      emailProvider
        .enviarRedefinicaoSenha
        .mock.calls[0][0];

    const link =
      new URL(envio.link);
    const token =
      new URLSearchParams(
        link.hash
          .replace(/^#/, "")
      ).get("token");

    expect(link.pathname)
      .toBe(
        "/redefinir-senha"
      );
    expect(link.search)
      .toBe("");
    expect(token)
      .toMatch(
        /^[A-Za-z0-9_-]{43}$/
      );

    const tokenHash =
      crypto
        .createHash("sha256")
        .update(token, "utf8")
        .digest("hex");

    const persistido =
      await db.query(
        `
          SELECT
            token_hash,
            usado_em,
            expira_em > NOW()
              AS valido
          FROM redefinicoes_senha
          WHERE usuario_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [usuario.id]
      );

    expect(
      persistido.rows[0]
        .token_hash
    ).toBe(tokenHash);
    expect(
      persistido.rows[0]
        .token_hash
    ).not.toBe(token);
    expect(
      persistido.rows[0]
        .usado_em
    ).toBeNull();
    expect(
      persistido.rows[0]
        .valido
    ).toBe(true);

    const tokenInvalido =
      Buffer.alloc(
        32,
        9
      ).toString(
        "base64url"
      );

    const tentativaInvalida =
      await request(app)
        .post(
          "/auth/redefinir-senha"
        )
        .send({
          token:
            tokenInvalido,
          senha:
            senhaNova,
        });

    expect(
      tentativaInvalida
        .statusCode
    ).toBe(400);

    const loginAntigoAntes =
      await request(app)
        .post("/login")
        .send({
          email:
            usuario.email,
          senha:
            senhaAntiga,
        });

    expect(
      loginAntigoAntes
        .statusCode
    ).toBe(200);

    const redefinicao =
      await request(app)
        .post(
          "/auth/redefinir-senha"
        )
        .send({
          token,
          senha:
            senhaNova,
        });

    expect(
      redefinicao.statusCode
    ).toBe(200);
    expect(
      redefinicao.body.mensagem
    ).toMatch(
      /Senha alterada com sucesso/i
    );

    const loginAntigo =
      await request(app)
        .post("/login")
        .send({
          email:
            usuario.email,
          senha:
            senhaAntiga,
        });

    expect(
      loginAntigo.statusCode
    ).toBe(401);

    const loginNovo =
      await request(app)
        .post("/login")
        .send({
          email:
            usuario.email,
          senha:
            senhaNova,
        });

    expect(
      loginNovo.statusCode
    ).toBe(200);

    const reutilizacao =
      await request(app)
        .post(
          "/auth/redefinir-senha"
        )
        .send({
          token,
          senha:
            "outra-senha-segura",
        });

    expect(
      reutilizacao.statusCode
    ).toBe(400);

    const tokenConsumido =
      await db.query(
        `
          SELECT usado_em
          FROM redefinicoes_senha
          WHERE token_hash = $1
        `,
        [tokenHash]
      );

    expect(
      tokenConsumido
        .rows[0]
        .usado_em
    ).toBeTruthy();
  });
});
