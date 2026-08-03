jest.setTimeout(30000);

const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../src/server");
const db = require("../src/db/db");

function gerarSufixoUnico() {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

describe("Fluxo de profissionais com banco real", () => {
  const usuariosCriados = [];
  const negociosCriados = [];
  const sufixo = gerarSufixoUnico();

  let donoA;
  let donoB;
  let profissionalVinculado;
  let profissionalDisponivel;
  let negocioA;
  let negocioB;
  let tokenDonoA;
  let tokenDonoB;
  let tokenProfissional;

  async function criarUsuario(nome, marcador, indice) {
    const finalWhatsapp =
      `${String(Date.now()).slice(-7)}${indice}`;

    const resultado = await db.query(
      `
      INSERT INTO usuarios (
        nome,
        email,
        senha,
        whatsapp
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id, nome, email, whatsapp
      `,
      [
        nome,
        `${marcador}.${sufixo}@teste.local`,
        "hash-de-teste",
        `629${finalWhatsapp}`
      ]
    );

    const usuario = resultado.rows[0];
    usuariosCriados.push(usuario.id);

    return usuario;
  }

  async function criarNegocio(nome, marcador, planoId) {
    const resultado = await db.query(
      `
      INSERT INTO negocios (
        nome,
        slug,
        plano_id
      )
      VALUES ($1, $2, $3)
      RETURNING id, nome, slug
      `,
      [
        nome,
        `teste-profissionais-${marcador}-${sufixo}`,
        planoId
      ]
    );

    const negocio = resultado.rows[0];
    negociosCriados.push(negocio.id);

    return negocio;
  }

  function gerarToken(usuarioId) {
    return jwt.sign(
      { id: usuarioId },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );
  }

  beforeAll(async () => {
    const plano = await db.query(
      `
      SELECT id
      FROM planos
      WHERE ativo = TRUE
        AND (
          limite_profissionais IS NULL
          OR limite_profissionais >= 3
        )
      ORDER BY limite_profissionais DESC NULLS FIRST
      LIMIT 1
      `
    );

    expect(plano.rows[0]).toBeTruthy();

    donoA = await criarUsuario("Dona Integração A", "dona-a", 1);
    donoB = await criarUsuario("Dona Integração B", "dona-b", 2);
    profissionalVinculado = await criarUsuario(
      "Profissional Vinculada",
      "vinculada",
      3
    );
    profissionalDisponivel = await criarUsuario(
      "Profissional Disponível",
      "disponivel",
      4
    );

    negocioA = await criarNegocio(
      "Negócio Integração A",
      "a",
      plano.rows[0].id
    );
    negocioB = await criarNegocio(
      "Negócio Integração B",
      "b",
      plano.rows[0].id
    );

    await db.query(
      `
      INSERT INTO usuarios_negocios (
        usuario_id,
        negocio_id,
        papel
      )
      VALUES
        ($1, $2, 'dono'),
        ($3, $4, 'dono'),
        ($5, $2, 'profissional')
      `,
      [
        donoA.id,
        negocioA.id,
        donoB.id,
        negocioB.id,
        profissionalVinculado.id
      ]
    );

    tokenDonoA = gerarToken(donoA.id);
    tokenDonoB = gerarToken(donoB.id);
    tokenProfissional = gerarToken(profissionalVinculado.id);
  });

  afterAll(async () => {
    try {
      if (negociosCriados.length > 0) {
        await db.query(
          `
          DELETE FROM negocios
          WHERE id = ANY($1::BIGINT[])
          `,
          [negociosCriados]
        );
      }

      if (usuariosCriados.length > 0) {
        await db.query(
          `
          DELETE FROM usuarios
          WHERE id = ANY($1::BIGINT[])
          `,
          [usuariosCriados]
        );
      }
    } finally {
      await db.end();
    }
  });

  test("dona vincula uma conta ativa sem depender de usuarios.tipo", async () => {
    const resposta = await request(app)
      .post("/profissionais/vincular")
      .set("Authorization", `Bearer ${tokenDonoA}`)
      .send({
        emailOuWhatsapp: profissionalDisponivel.email.toUpperCase()
      });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.body.profissional).toMatchObject({
      id: profissionalDisponivel.id,
      nome: profissionalDisponivel.nome,
      email: profissionalDisponivel.email
    });
    expect(resposta.body.profissional).not.toHaveProperty("tipo");

    const vinculo = await db.query(
      `
      SELECT papel, ativo
      FROM usuarios_negocios
      WHERE usuario_id = $1
        AND negocio_id = $2
      `,
      [profissionalDisponivel.id, negocioA.id]
    );

    expect(vinculo.rows).toEqual([
      {
        papel: "profissional",
        ativo: true
      }
    ]);
  });

  test("dona edita apenas o perfil do vínculo com o negócio", async () => {
    const resposta = await request(app)
      .put(`/profissionais/${profissionalVinculado.id}`)
      .set("Authorization", `Bearer ${tokenDonoA}`)
      .send({
        nome: "  Profissional Atualizada  ",
        whatsapp: "(62) 99999-1234"
      });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body.profissional).toMatchObject({
      id: profissionalVinculado.id,
      nome: "Profissional Atualizada",
      whatsapp: "62999991234"
    });
    expect(resposta.body.profissional).not.toHaveProperty("tipo");

    const contaGlobal = await db.query(
      `
      SELECT nome, whatsapp
      FROM usuarios
      WHERE id = $1
      `,
      [profissionalVinculado.id]
    );

    expect(contaGlobal.rows[0]).toMatchObject({
      nome: profissionalVinculado.nome,
      whatsapp: profissionalVinculado.whatsapp
    });

    const perfilNoNegocio = await db.query(
      `
      SELECT nome_exibicao, whatsapp_exibicao
      FROM usuarios_negocios
      WHERE usuario_id = $1
        AND negocio_id = $2
      `,
      [profissionalVinculado.id, negocioA.id]
    );

    expect(perfilNoNegocio.rows[0]).toEqual({
      nome_exibicao: "Profissional Atualizada",
      whatsapp_exibicao: "62999991234"
    });
  });

  test("dona de outro negócio não edita o profissional", async () => {
    const resposta = await request(app)
      .put(`/profissionais/${profissionalVinculado.id}`)
      .set("Authorization", `Bearer ${tokenDonoB}`)
      .send({
        nome: "Alteração indevida",
        whatsapp: "62999991234"
      });

    expect(resposta.statusCode).toBe(404);

    const usuario = await db.query(
      `
      SELECT nome
      FROM usuarios
      WHERE id = $1
      `,
      [profissionalVinculado.id]
    );

    expect(usuario.rows[0].nome).toBe(profissionalVinculado.nome);
  });

  test("profissional sem papel de dona não adiciona pessoas", async () => {
    const resposta = await request(app)
      .post("/profissionais/vincular")
      .set("Authorization", `Bearer ${tokenProfissional}`)
      .send({
        emailOuWhatsapp: profissionalDisponivel.email
      });

    expect(resposta.statusCode).toBe(403);
  });

  test("edição rejeita WhatsApp inválido antes de consultar o banco", async () => {
    const resposta = await request(app)
      .put(`/profissionais/${profissionalVinculado.id}`)
      .set("Authorization", `Bearer ${tokenDonoA}`)
      .send({
        nome: "Profissional Atualizada",
        whatsapp: "123"
      });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.body.erro).toBe(
      "WhatsApp do profissional inválido."
    );
  });

  test("somente a dona do negócio remove o vínculo", async () => {
    const tentativaExterna = await request(app)
      .delete(`/profissionais/${profissionalVinculado.id}`)
      .set("Authorization", `Bearer ${tokenDonoB}`);

    expect(tentativaExterna.statusCode).toBe(404);

    const resposta = await request(app)
      .delete(`/profissionais/${profissionalVinculado.id}`)
      .set("Authorization", `Bearer ${tokenDonoA}`);

    expect(resposta.statusCode).toBe(200);

    const vinculo = await db.query(
      `
      SELECT id
      FROM usuarios_negocios
      WHERE usuario_id = $1
        AND negocio_id = $2
      `,
      [profissionalVinculado.id, negocioA.id]
    );

    expect(vinculo.rowCount).toBe(0);
  });
});
