require("dotenv").config();

const db = require(
  "../src/db/db"
);

const PAPEIS_PERMITIDOS =
  new Set([
    "admin",
    "superadmin",
  ]);

function normalizarEmail(
  valor
) {
  return String(
    valor || ""
  )
    .trim()
    .toLowerCase();
}

function normalizarPapel(
  valor
) {
  const papel =
    String(
      valor || "admin"
    )
      .trim()
      .toLowerCase();

  if (
    !PAPEIS_PERMITIDOS.has(
      papel
    )
  ) {
    throw new Error(
      'Papel inválido. Use "admin" ou "superadmin".'
    );
  }

  return papel;
}

function validarEmail(
  email
) {
  if (
    !email ||
    email.length > 160 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    throw new Error(
      "Informe um e-mail válido."
    );
  }
}

async function promoverAdministrador({
  email,
  papel,
}) {
  const cliente =
    await db.connect();

  try {
    await cliente.query(
      "BEGIN"
    );

    const usuarioResultado =
      await cliente.query(
        `
          SELECT
            id,
            nome,
            email,
            ativo

          FROM usuarios

          WHERE LOWER(email) = LOWER($1)

          LIMIT 1

          FOR UPDATE
        `,
        [
          email,
        ]
      );

    const usuario =
      usuarioResultado.rows[0] ||
      null;

    if (!usuario) {
      throw new Error(
        `Nenhum usuário encontrado com o e-mail ${email}.`
      );
    }

    if (
      usuario.ativo === false
    ) {
      throw new Error(
        "Não é possível promover uma conta desativada."
      );
    }

    const administradorResultado =
      await cliente.query(
        `
          INSERT INTO
            usuarios_administradores (
              usuario_id,
              papel,
              ativo,
              created_at,
              updated_at
            )

          VALUES (
            $1,
            $2,
            TRUE,
            NOW(),
            NOW()
          )

          ON CONFLICT (
            usuario_id
          )

          DO UPDATE SET
            papel =
              EXCLUDED.papel,

            ativo =
              TRUE,

            updated_at =
              NOW()

          RETURNING
            usuario_id,
            papel,
            ativo,
            created_at,
            updated_at
        `,
        [
          usuario.id,
          papel,
        ]
      );

    await cliente.query(
      "COMMIT"
    );

    return {
      usuario: {
        id:
          Number(
            usuario.id
          ),

        nome:
          usuario.nome,

        email:
          usuario.email,
      },

      administrador:
        administradorResultado
          .rows[0],
    };
  } catch (erro) {
    await cliente.query(
      "ROLLBACK"
    );

    throw erro;
  } finally {
    cliente.release();
  }
}

async function executar() {
  const email =
    normalizarEmail(
      process.argv[2]
    );

  const papel =
    normalizarPapel(
      process.argv[3]
    );

  validarEmail(
    email
  );

  const resultado =
    await promoverAdministrador({
      email,
      papel,
    });

  console.log(
    "\nAdministrador configurado com sucesso.\n"
  );

  console.table([
    {
      usuario_id:
        resultado.usuario.id,

      nome:
        resultado.usuario.nome,

      email:
        resultado.usuario.email,

      papel:
        resultado
          .administrador
          .papel,

      ativo:
        resultado
          .administrador
          .ativo,
    },
  ]);
}

executar()
  .catch(
    (erro) => {
      console.error(
        "\nNão foi possível configurar o administrador:"
      );

      console.error(
        erro?.message ||
        erro
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await db.end();
    }
  );