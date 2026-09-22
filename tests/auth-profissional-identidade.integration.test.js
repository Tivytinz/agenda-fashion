jest.setTimeout(60000);

process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "wave-10-auth-secret-with-at-least-32-characters";

const jwt = require("jsonwebtoken");
const request = require("supertest");

const app = require("../src/server");
const db = require("../src/db/db");

function chaveUnica() {
  return `${process.pid}-${Date.now()}-${Math.floor(
    Math.random() * 1000000
  )}`;
}

function token(usuarioId) {
  return jwt.sign(
    { id: usuarioId },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
}

describe("Wave 10 - identidade profissional P0", () => {
  const usuarios = [];
  const negocios = [];
  const clientes = [];
  const chave = chaveUnica();
  let sequenciaWhatsapp = 0;

  function whatsappUnico() {
    sequenciaWhatsapp += 1;
    const base = String(
      Date.now() + sequenciaWhatsapp
    ).slice(-9);

    return `62${base}`;
  }

  async function cadastrar({
    rotulo,
    profissional = false,
  }) {
    const email =
      `${rotulo}.${chave}@teste.local`;

    const resposta = await request(app)
      .post("/cadastro")
      .send({
        nome: `Pessoa ${rotulo}`,
        email,
        whatsapp: whatsappUnico(),
        senha: "senha123",
        perfil_profissional:
          profissional,
      });

    expect(resposta.statusCode).toBe(201);

    usuarios.push(
      Number(resposta.body.usuario.id)
    );

    return {
      ...resposta.body.usuario,
      email,
    };
  }

  async function criarNegocio(usuarioId) {
    const resposta = await request(app)
      .post("/criar-negocio")
      .set(
        "Authorization",
        `Bearer ${token(usuarioId)}`
      )
      .send({
        nome:
          `Studio Auth ${chave}`,
        descricao:
          "Studio para teste de identidade.",
        especialidades: ["Unhas"],
        whatsapp: "62999999999",
        cidade: "Goiânia",
        estado: "GO",
        bairro: "Centro",
        endereco: "Rua Teste",
        numero: "10",
        complemento: "",
        cep: "74000123",
        localizacao_url:
          "https://maps.google.com/?q=goiania",
      });

    expect(resposta.statusCode).toBe(201);

    negocios.push(
      Number(resposta.body.negocio.id)
    );

    return resposta.body.negocio;
  }

  afterAll(async () => {
    try {
      if (negocios.length > 0) {
        await db.query(
          `
            DELETE FROM negocios
            WHERE id = ANY($1::BIGINT[])
          `,
          [negocios]
        );
      }

      if (clientes.length > 0) {
        await db.query(
          `
            DELETE FROM clientes
            WHERE id = ANY($1::BIGINT[])
          `,
          [clientes]
        );
      }

      if (usuarios.length > 0) {
        await db.query(
          `
            DELETE FROM usuarios
            WHERE id = ANY($1::BIGINT[])
          `,
          [usuarios]
        );
      }
    } finally {
      await db.end();
    }
  });

  test("CA-AUT-01: cadastro profissional cria uma única identidade com perfil profissional", async () => {
    const profissional =
      await cadastrar({
        rotulo:
          "cadastro-profissional",
        profissional: true,
      });

    expect(
      profissional
        .perfil_profissional_ativo
    ).toBe(true);

    const persistido = await db.query(
      `
        SELECT
          COUNT(*)::INT AS total,
          MAX(
            perfil_profissional_ativado_em
          ) AS perfil_profissional_ativado_em
        FROM usuarios
        WHERE LOWER(email) = LOWER($1)
      `,
      [profissional.email]
    );

    expect(
      Number(persistido.rows[0].total)
    ).toBe(1);
    expect(
      persistido.rows[0]
        .perfil_profissional_ativado_em
    ).toBeTruthy();
  });

  test("CA-AUT-02: conta cliente preserva Client e identidade ao virar profissional", async () => {
    const dona =
      await cadastrar({
        rotulo: "dona-ex-cliente",
      });

    expect(
      dona.perfil_profissional_ativo
    ).toBe(false);

    const negocio =
      await criarNegocio(dona.id);

    const donaDepois = await db.query(
      `
        SELECT
          perfil_profissional_ativado_em
        FROM usuarios
        WHERE id = $1
      `,
      [dona.id]
    );

    expect(
      donaDepois.rows[0]
        .perfil_profissional_ativado_em
    ).toBeTruthy();

    const convidada =
      await cadastrar({
        rotulo:
          "cliente-convidada",
      });

    expect(
      convidada
        .perfil_profissional_ativo
    ).toBe(false);

    const clientCriado = await db.query(
      `
        INSERT INTO clientes (
          usuario_id,
          nome,
          whatsapp_normalizado,
          origem
        )
        SELECT
          id,
          nome,
          whatsapp,
          'conta'
        FROM usuarios
        WHERE id = $1
        RETURNING id, usuario_id
      `,
      [convidada.id]
    );

    const clientId =
      Number(clientCriado.rows[0].id);
    clientes.push(clientId);

    const convite = await request(app)
      .post("/profissionais/convites")
      .set(
        "Authorization",
        `Bearer ${token(dona.id)}`
      )
      .send({
        emailOuWhatsapp:
          convidada.email,
      });

    expect(convite.statusCode).toBe(201);

    const conviteId =
      convite.body.convite.id;

    const aceite = await request(app)
      .post(
        `/profissionais/convites/${conviteId}/aceitar`
      )
      .set(
        "Authorization",
        `Bearer ${token(convidada.id)}`
      );

    expect(aceite.statusCode).toBe(200);

    const identidade = await db.query(
      `
        SELECT
          u.id,
          u.email,
          u.perfil_profissional_ativado_em,
          c.id AS client_id,
          c.usuario_id AS client_usuario_id,
          un.negocio_id,
          un.papel
        FROM usuarios u
        INNER JOIN clientes c
          ON c.usuario_id = u.id
        INNER JOIN usuarios_negocios un
          ON un.usuario_id = u.id
        WHERE u.id = $1
          AND un.negocio_id = $2
      `,
      [
        convidada.id,
        negocio.id,
      ]
    );

    expect(identidade.rows).toHaveLength(1);
    expect(
      Number(
        identidade.rows[0].id
      )
    ).toBe(
      Number(convidada.id)
    );
    expect(
      Number(
        identidade.rows[0]
          .client_id
      )
    ).toBe(clientId);
    expect(
      Number(
        identidade.rows[0]
          .client_usuario_id
      )
    ).toBe(
      Number(convidada.id)
    );
    expect(
      identidade.rows[0]
        .perfil_profissional_ativado_em
    ).toBeTruthy();
    expect(
      identidade.rows[0].papel
    ).toBe("profissional");

    const totalUsuarios =
      await db.query(
        `
          SELECT COUNT(*)::INT AS total
          FROM usuarios
          WHERE LOWER(email) =
            LOWER($1)
        `,
        [convidada.email]
      );

    expect(
      Number(
        totalUsuarios.rows[0].total
      )
    ).toBe(1);
  });
});
