const crypto = require("crypto");
const db = require("../src/db/db");
const repository = require(
  "../src/repositories/adminOperationRepository"
);

function suffix() {
  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe("Admin Wave 1 - operação integrada RF40", () => {
  const usuarios = [];
  const negocios = [];

  afterEach(async () => {
    for (const negocioId of negocios.splice(0)) {
      await db.query(
        "DELETE FROM usuarios_negocios WHERE negocio_id = $1",
        [negocioId]
      );
      await db.query(
        "DELETE FROM negocios WHERE id = $1",
        [negocioId]
      );
    }

    for (const usuarioId of usuarios.splice(0)) {
      await db.query(
        "DELETE FROM usuarios_administradores WHERE usuario_id = $1",
        [usuarioId]
      );
      await db.query(
        "DELETE FROM usuarios WHERE id = $1",
        [usuarioId]
      );
    }
  });

  afterAll(() => db.end());

  test("consulta usuário e negócio com estados operacionais reais do schema", async () => {
    const id = suffix();
    const usuario = await db.query(
      `
      INSERT INTO usuarios (
        nome,
        email,
        senha,
        whatsapp,
        ativo,
        email_verificado_em,
        perfil_profissional_ativado_em
      )
      VALUES (
        'Operação Wave 1',
        $1,
        'hash_admin_wave1',
        '62999999999',
        TRUE,
        NOW(),
        NOW()
      )
      RETURNING id
      `,
      [`admin_wave1_${id}@test.local`]
    );
    const usuarioId = Number(usuario.rows[0].id);
    usuarios.push(usuarioId);

    await db.query(
      `
      INSERT INTO usuarios_administradores (
        usuario_id,
        papel,
        ativo
      )
      VALUES ($1, 'admin', TRUE)
      `,
      [usuarioId]
    );

    const negocio = await db.query(
      `
      INSERT INTO negocios (
        nome,
        slug,
        setor,
        whatsapp,
        cidade,
        estado,
        publicado
      )
      VALUES (
        $1,
        $2,
        'unhas',
        '62999999999',
        'Goiânia',
        'GO',
        FALSE
      )
      RETURNING id
      `,
      [
        `Studio Wave 1 ${id}`,
        `studio-wave-1-${id}`
      ]
    );
    const negocioId = Number(negocio.rows[0].id);
    negocios.push(negocioId);

    await db.query(
      `
      INSERT INTO usuarios_negocios (
        usuario_id,
        negocio_id,
        papel,
        ativo
      )
      VALUES ($1, $2, 'dono', TRUE)
      `,
      [usuarioId, negocioId]
    );

    const usuariosResultado = await repository.listarUsuarios({
      busca: `admin_wave1_${id}@test.local`,
      status: "ativo",
      limite: 25,
      offset: 0
    });

    expect(usuariosResultado.total).toBe(1);
    expect(usuariosResultado.rows[0]).toMatchObject({
      nome: "Operação Wave 1",
      ativo: true,
      papel_admin: "admin",
      total_negocios_ativos: 1
    });
    expect(usuariosResultado.rows[0].papeis_negocio).toContain("dono");

    const negociosResultado = await repository.listarNegocios({
      busca: `Studio Wave 1 ${id}`,
      status: "rascunho",
      limite: 25,
      offset: 0
    });

    expect(negociosResultado.total).toBe(1);
    expect(negociosResultado.rows[0]).toMatchObject({
      id: negocioId,
      publicado: false,
      dono_id: usuarioId,
      dono_nome: "Operação Wave 1"
    });
    expect(negociosResultado.rows[0].plano_slug).toBeTruthy();
  });
});
