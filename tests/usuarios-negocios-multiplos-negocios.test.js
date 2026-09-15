const crypto = require("crypto");
const db = require("../src/db/db");

jest.setTimeout(30000);

describe("vínculos profissionais em múltiplos negócios", () => {
  const usuariosCriados = [];
  const negociosCriados = [];

  async function criarUsuario(nome, prefixo) {
    const sufixo = crypto.randomUUID();
    const resultado = await db.query(
      `
        INSERT INTO usuarios (nome, email, senha, whatsapp)
        VALUES ($1, $2, 'hash-teste', $3)
        RETURNING id
      `,
      [
        nome,
        `${prefixo}-${sufixo}@teste.local`,
        `62${crypto.randomInt(100000000, 999999999)}`,
      ]
    );

    usuariosCriados.push(resultado.rows[0].id);
    return resultado.rows[0];
  }

  async function criarNegocio(nome, donoId) {
    const plano = await db.query(
      `SELECT id FROM planos WHERE slug = 'inicial' AND ativo = TRUE LIMIT 1`
    );

    const resultado = await db.query(
      `
        INSERT INTO negocios (nome, slug, plano_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [nome, `${nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomUUID()}`, plano.rows[0].id]
    );

    const negocioId = resultado.rows[0].id;
    negociosCriados.push(negocioId);

    await db.query(
      `
        INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel)
        VALUES ($1, $2, 'dono')
      `,
      [donoId, negocioId]
    );

    return negocioId;
  }

  afterAll(async () => {
    try {
      if (negociosCriados.length > 0) {
        await db.query(
          `DELETE FROM usuarios_negocios WHERE negocio_id = ANY($1::BIGINT[])`,
          [negociosCriados]
        );
        await db.query(
          `DELETE FROM negocios WHERE id = ANY($1::BIGINT[])`,
          [negociosCriados]
        );
      }

      if (usuariosCriados.length > 0) {
        await db.query(
          `DELETE FROM usuarios WHERE id = ANY($1::BIGINT[])`,
          [usuariosCriados]
        );
      }
    } finally {
      await db.end();
    }
  });

  test("permite a mesma profissional ativa em negócios distintos e preserva unicidade por negócio", async () => {
    const donaA = await criarUsuario("Dona Multi A", "dona-multi-a");
    const donaB = await criarUsuario("Dona Multi B", "dona-multi-b");
    const profissional = await criarUsuario("Profissional Multi", "prof-multi");

    const negocioA = await criarNegocio("Studio Multi A", donaA.id);
    const negocioB = await criarNegocio("Studio Multi B", donaB.id);

    await db.query(
      `
        INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel)
        VALUES
          ($1, $2, 'profissional'),
          ($1, $3, 'profissional')
      `,
      [profissional.id, negocioA, negocioB]
    );

    const vinculos = await db.query(
      `
        SELECT negocio_id
        FROM usuarios_negocios
        WHERE usuario_id = $1
          AND papel = 'profissional'
          AND ativo = TRUE
        ORDER BY negocio_id
      `,
      [profissional.id]
    );

    expect(vinculos.rows.map((item) => Number(item.negocio_id))).toEqual(
      [Number(negocioA), Number(negocioB)].sort((a, b) => a - b)
    );

    await expect(
      db.query(
        `
          INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel)
          VALUES ($1, $2, 'profissional')
        `,
        [profissional.id, negocioA]
      )
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "usuarios_negocios_vinculo_unico",
    });
  });
});
