const crypto = require(
  "crypto"
);
const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/marketingAttributionRecoveryRepository"
);

function suffix() {
  return crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

async function criarProfissional(prefixo) {
  const id = suffix();
  const usuario =
    await db.query(
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
        '62999999999'
      )
      RETURNING id, created_at
      `,
      [
        `${prefixo} ${id}`,
        `${prefixo.toLowerCase()}-${id}@example.com`,
      ]
    );

  const usuarioId =
    Number(usuario.rows[0].id);

  await db.query(
    `
    INSERT INTO marketing_usuario_atribuicoes (
      usuario_id,
      intencao,
      atribuicao_em
    )
    VALUES (
      $1,
      'profissional',
      $2
    )
    `,
    [
      usuarioId,
      usuario.rows[0].created_at,
    ]
  );

  return {
    usuarioId,
    sessaoId: `sessao_${id}`,
  };
}

async function registrarEvento({
  usuarioId,
  sessaoId,
  propriedades,
}) {
  await db.query(
    `
    INSERT INTO eventos_produto (
      nome,
      pagina,
      missao,
      sessao_id,
      usuario_id,
      propriedades
    )
    VALUES (
      'tela_visualizada',
      'criar_negocio',
      'organizar_negocio',
      $1,
      $2,
      $3::JSONB
    )
    `,
    [
      sessaoId,
      usuarioId,
      JSON.stringify(propriedades),
    ]
  );
}

describe(
  "recuperação integrada da atribuição profissional",
  () => {
    const usuarios = [];

    afterEach(async () => {
      if (!usuarios.length) {
        return;
      }

      await db.query(
        `
        DELETE FROM eventos_produto
        WHERE usuario_id = ANY($1::BIGINT[])
        `,
        [usuarios]
      );

      await db.query(
        `
        DELETE FROM usuarios
        WHERE id = ANY($1::BIGINT[])
        `,
        [usuarios]
      );

      usuarios.length = 0;
    });

    test(
      "recupera somente evidência Google forte próxima ao cadastro",
      async () => {
        const comClique =
          await criarProfissional("ComClique");
        const utmOficial =
          await criarProfissional("UtmOficial");
        const naoVerificado =
          await criarProfissional("NaoVerificado");

        usuarios.push(
          comClique.usuarioId,
          utmOficial.usuarioId,
          naoVerificado.usuarioId
        );

        await registrarEvento({
          ...comClique,
          propriedades: {
            gclid: `gclid-${suffix()}`,
            landing_page:
              "/cadastro?tipo=profissional",
          },
        });

        await registrarEvento({
          ...utmOficial,
          propriedades: {
            utm_source: "google",
            utm_medium: "cpc",
            utm_campaign:
              "google_ads_profissionais",
            landing_page:
              "/cadastro?tipo=profissional",
          },
        });

        await registrarEvento({
          ...naoVerificado,
          propriedades: {
            utm_source: "google",
            utm_medium: "cpc",
            utm_campaign:
              "campanha_nao_oficial",
          },
        });

        const resultado =
          await repository
            .recuperarGoogleProfissionaisPorEventos({
              client: db,
              campanhaOficial:
                "google_ads_profissionais",
            });

        expect(resultado.rowCount)
          .toBeGreaterThanOrEqual(2);

        const atribuicoes =
          await db.query(
            `
            SELECT
              usuario_id,
              utm_source,
              utm_medium,
              utm_campaign,
              gclid,
              sessao_id
            FROM marketing_usuario_atribuicoes
            WHERE usuario_id = ANY($1::BIGINT[])
            ORDER BY usuario_id
            `,
            [usuarios]
          );

        const porUsuario =
          new Map(
            atribuicoes.rows.map(
              (item) => [
                Number(item.usuario_id),
                item,
              ]
            )
          );

        expect(
          porUsuario.get(
            comClique.usuarioId
          )
        ).toMatchObject({
          utm_source: "google",
          utm_medium: "cpc",
          utm_campaign: null,
          sessao_id:
            comClique.sessaoId,
        });

        expect(
          porUsuario.get(
            comClique.usuarioId
          ).gclid
        ).toMatch(/^gclid-/);

        expect(
          porUsuario.get(
            utmOficial.usuarioId
          )
        ).toMatchObject({
          utm_source: "google",
          utm_medium: "cpc",
          utm_campaign:
            "google_ads_profissionais",
          gclid: null,
          sessao_id:
            utmOficial.sessaoId,
        });

        expect(
          porUsuario.get(
            naoVerificado.usuarioId
          )
        ).toMatchObject({
          utm_source: null,
          utm_medium: null,
          utm_campaign: null,
          gclid: null,
          sessao_id: null,
        });
      }
    );
  }
);
