jest.setTimeout(60000);

const jwt = require("jsonwebtoken");
const request = require("supertest");

const app = require("../src/server");
const db = require("../src/db/db");

function idCurto() {
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

describe("elegibilidade profissional-serviço", () => {
  const usuarios = [];
  let negocioId;
  let servicoAId;
  let servicoBId;
  let dono;
  let profissional;
  let slug;

  beforeAll(async () => {
    const chave = idCurto();
    slug = `studio-elegibilidade-${chave}`;

    const plano = await db.query(
      `SELECT id FROM planos WHERE slug = 'inicial' AND ativo = TRUE LIMIT 1`
    );

    async function criarUsuario(nome, prefixo) {
      const result = await db.query(
        `
          INSERT INTO usuarios (
            nome,
            email,
            senha,
            whatsapp
          )
          VALUES (
            $1,
            $2,
            'hash-de-teste',
            $3
          )
          RETURNING id
        `,
        [
          nome,
          `${prefixo}-${chave}@teste.local`,
          `629${String(Date.now() + usuarios.length).slice(-8)}`,
        ]
      );

      usuarios.push(result.rows[0].id);
      return result.rows[0];
    }

    dono = await criarUsuario(
      "Dona Elegibilidade",
      "dona-elegibilidade"
    );
    profissional = await criarUsuario(
      "Profissional Elegibilidade",
      "prof-elegibilidade"
    );

    const negocio = await db.query(
      `
        INSERT INTO negocios (
          nome,
          slug,
          plano_id,
          publicado,
          fuso_horario
        )
        VALUES (
          'Studio Elegibilidade',
          $1,
          $2,
          TRUE,
          'America/Sao_Paulo'
        )
        RETURNING id
      `,
      [slug, plano.rows[0].id]
    );

    negocioId = negocio.rows[0].id;

    await db.query(
      `
        INSERT INTO usuarios_negocios (
          usuario_id,
          negocio_id,
          papel
        )
        VALUES
          ($1, $3, 'dono'),
          ($2, $3, 'profissional')
      `,
      [
        dono.id,
        profissional.id,
        negocioId,
      ]
    );

    const servicos = await db.query(
      `
        INSERT INTO servicos_negocio (
          negocio_id,
          nome,
          valor,
          duracao_minutos,
          ativo
        )
        VALUES
          ($1, 'Manicure elegível', 50, 60, TRUE),
          ($1, 'Pedicure não elegível', 45, 45, TRUE)
        RETURNING id, nome
      `,
      [negocioId]
    );

    servicoAId = servicos.rows.find(
      (item) => item.nome === "Manicure elegível"
    ).id;
    servicoBId = servicos.rows.find(
      (item) => item.nome === "Pedicure não elegível"
    ).id;
  });

  afterAll(async () => {
    try {
      if (negocioId) {
        await db.query(
          `DELETE FROM servicos_profissionais WHERE negocio_id = $1`,
          [negocioId]
        );
        await db.query(
          `DELETE FROM servicos_negocio WHERE negocio_id = $1`,
          [negocioId]
        );
        await db.query(
          `DELETE FROM usuarios_negocios WHERE negocio_id = $1`,
          [negocioId]
        );
        await db.query(
          `DELETE FROM negocios WHERE id = $1`,
          [negocioId]
        );
      }

      if (usuarios.length) {
        await db.query(
          `DELETE FROM usuarios WHERE id = ANY($1::BIGINT[])`,
          [usuarios]
        );
      }
    } finally {
      await db.end();
    }
  });

  test("CA-EQP-06: apenas a proprietária configura serviços da profissional", async () => {
    const negado = await request(app)
      .put(`/profissionais/${profissional.id}/servicos`)
      .set(
        "Authorization",
        `Bearer ${token(profissional.id)}`
      )
      .send({
        servico_ids: [servicoAId],
      });

    expect(negado.statusCode).toBe(403);

    const resposta = await request(app)
      .put(`/profissionais/${profissional.id}/servicos`)
      .set(
        "Authorization",
        `Bearer ${token(dono.id)}`
      )
      .send({
        servico_ids: [servicoAId],
      });

    expect(resposta.statusCode).toBe(200);

    const porId = new Map(
      resposta.body.servicos.map((item) => [
        Number(item.id),
        item,
      ])
    );

    expect(
      porId.get(Number(servicoAId)).habilitada
    ).toBe(true);
    expect(
      porId.get(Number(servicoBId)).habilitada
    ).toBe(false);
  });

  test("CA-EQP-06: leitura de elegíveis contém somente quem foi habilitada", async () => {
    const resposta = await request(app)
      .get(
        `/servicos/${servicoAId}/profissionais-elegiveis`
      )
      .set(
        "Authorization",
        `Bearer ${token(dono.id)}`
      );

    expect(resposta.statusCode).toBe(200);
    expect(
      resposta.body.profissionais.map(
        (item) => Number(item.id)
      )
    ).toEqual([
      Number(profissional.id),
    ]);
  });

  test("CA-EQP-06: API pública rejeita profissional ativa sem habilitação para o serviço", async () => {
    const resposta = await request(app)
      .get("/agenda-publica")
      .query({
        slug,
        servicoId: servicoBId,
        profissionalId:
          profissional.id,
      });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.body.erro).toMatch(
      /não está habilitada/i
    );
  });

  test("RN53: remover toda elegibilidade deixa serviço sem profissional disponível", async () => {
    const resposta = await request(app)
      .put(`/profissionais/${profissional.id}/servicos`)
      .set(
        "Authorization",
        `Bearer ${token(dono.id)}`
      )
      .send({
        servico_ids: [],
      });

    expect(resposta.statusCode).toBe(200);
    expect(
      resposta.body.servicos.every(
        (item) => item.habilitada === false
      )
    ).toBe(true);

    const elegiveis = await request(app)
      .get(
        `/servicos/${servicoAId}/profissionais-elegiveis`
      )
      .set(
        "Authorization",
        `Bearer ${token(dono.id)}`
      );

    expect(elegiveis.statusCode).toBe(200);
    expect(elegiveis.body.profissionais).toEqual([]);
  });
});
