jest.setTimeout(60000);

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

describe("elegibilidade profissional-serviço integrada", () => {
  const usuarios = [];
  let dono;
  let profissional;
  let negocioId;
  let slug;
  let servico1;
  let servico2;

  beforeAll(async () => {
    const chave = chaveUnica();

    const plano = await db.query(
      `
        SELECT id
        FROM planos
        WHERE ativo = TRUE
        ORDER BY id
        LIMIT 1
      `
    );

    expect(plano.rows[0]?.id).toBeTruthy();

    async function criarUsuario(nome, prefixo) {
      const resultado = await db.query(
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
            'hash-teste',
            $3
          )
          RETURNING id
        `,
        [
          nome,
          `${prefixo}-${chave}@teste.local`,
          `629${String(
            Date.now() + usuarios.length
          ).slice(-8)}`,
        ]
      );

      usuarios.push(resultado.rows[0].id);
      return resultado.rows[0];
    }

    dono = await criarUsuario(
      "Dona Elegibilidade",
      "dona-elegibilidade"
    );

    profissional = await criarUsuario(
      "Profissional Elegibilidade",
      "prof-elegibilidade"
    );

    slug = `studio-elegibilidade-${chave}`;

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
      [
        slug,
        plano.rows[0].id,
      ]
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
          ($1, 'Manicure Elegível', 50, 60, TRUE),
          ($1, 'Pedicure Restrita', 55, 60, TRUE)
        RETURNING id, nome
      `,
      [negocioId]
    );

    servico1 = servicos.rows[0];
    servico2 = servicos.rows[1];
  });

  afterAll(async () => {
    try {
      if (negocioId) {
        await db.query(
          `
            DELETE FROM profissional_servicos
            WHERE negocio_id = $1
          `,
          [negocioId]
        );

        await db.query(
          `
            DELETE FROM servicos_negocio
            WHERE negocio_id = $1
          `,
          [negocioId]
        );

        await db.query(
          `
            DELETE FROM usuarios_negocios
            WHERE negocio_id = $1
          `,
          [negocioId]
        );

        await db.query(
          `
            DELETE FROM negocios
            WHERE id = $1
          `,
          [negocioId]
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

  test("CA-EQP-06: proprietária materializa serviços explícitos da profissional", async () => {
    const inicial = await request(app)
      .get(
        `/profissionais/${profissional.id}/servicos`
      )
      .set(
        "Authorization",
        `Bearer ${token(dono.id)}`
      );

    expect(inicial.statusCode).toBe(200);
    expect(
      inicial.body.servicos
        .filter((item) => item.habilitado)
    ).toHaveLength(0);

    const atualizado = await request(app)
      .put(
        `/profissionais/${profissional.id}/servicos`
      )
      .set(
        "Authorization",
        `Bearer ${token(dono.id)}`
      )
      .send({
        servico_ids: [servico1.id],
      });

    expect(atualizado.statusCode).toBe(200);

    const persistido = await db.query(
      `
        SELECT servico_id
        FROM profissional_servicos
        WHERE negocio_id = $1
          AND profissional_id = $2
        ORDER BY servico_id
      `,
      [
        negocioId,
        profissional.id,
      ]
    );

    expect(
      persistido.rows.map(
        (item) =>
          Number(item.servico_id)
      )
    ).toEqual([
      Number(servico1.id),
    ]);
  });

  test("CA-EQP-06: perfil público expõe a elegibilidade configurada", async () => {
    const resposta = await request(app)
      .get(
        `/perfil-negocio/${slug}`
      );

    expect(resposta.statusCode).toBe(200);

    const pessoa =
      resposta.body.profissionais
        .find(
          (item) =>
            Number(item.id) ===
            Number(profissional.id)
        );

    expect(pessoa).toBeTruthy();

    expect(
      (pessoa.servico_ids || [])
        .map(Number)
    ).toEqual([
      Number(servico1.id),
    ]);

    expect(
      (pessoa.servico_ids || [])
        .map(Number)
    ).not.toContain(
      Number(servico2.id)
    );
  });

  test("CA-EQP-06: API pública rejeita combinação profissional-serviço não habilitada", async () => {
    const resposta = await request(app)
      .get("/agenda-publica")
      .query({
        slug,
        servicoId:
          servico2.id,
        profissionalId:
          profissional.id,
      });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.body.erro).toMatch(
      /não está disponível para este serviço/i
    );
  });

  test("somente a proprietária pode alterar a matriz de serviços", async () => {
    const resposta = await request(app)
      .put(
        `/profissionais/${profissional.id}/servicos`
      )
      .set(
        "Authorization",
        `Bearer ${token(profissional.id)}`
      )
      .send({
        servico_ids: [
          servico1.id,
          servico2.id,
        ],
      });

    expect(resposta.statusCode).toBe(403);
  });
});
