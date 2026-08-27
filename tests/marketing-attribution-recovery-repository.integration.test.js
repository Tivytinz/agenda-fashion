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
  const sessaoId = `sessao_${id}`;

  await db.query(
    `
    INSERT INTO marketing_usuario_atribuicoes (
      usuario_id,
      intencao,
      sessao_id,
      atribuicao_em
    )
    VALUES (
      $1,
      'profissional',
      $2,
      $3
    )
    `,
    [
      usuarioId,
      sessaoId,
      usuario.rows[0].created_at,
    ]
  );

  return {
    usuarioId,
    sessaoId,
  };
}

async function registrarEvento({
  usuarioId,
  sessaoId,
  propriedades,
  momento,
}) {
  await db.query(
    `
    INSERT INTO eventos_produto (
      nome,
      pagina,
      missao,
      sessao_id,
      usuario_id,
      propriedades,
      created_at
    )
    VALUES (
      'tela_visualizada',
      'criar_negocio',
      'organizar_negocio',
      $1,
      $2,
      $3::JSONB,
      COALESCE($4::TIMESTAMPTZ, NOW())
    )
    `,
    [
      sessaoId,
      usuarioId ?? null,
      JSON.stringify(propriedades),
      momento || null,
    ]
  );
}

describe(
  "recuperação integrada da atribuição profissional",
  () => {
    const usuarios = [];
    const sessoes = [];

    afterEach(async () => {
      if (sessoes.length) {
        await db.query(
          `
          DELETE FROM eventos_produto
          WHERE sessao_id = ANY($1::VARCHAR[])
          `,
          [sessoes]
        );
      }

      if (usuarios.length) {
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
      }

      usuarios.length = 0;
      sessoes.length = 0;
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
        sessoes.push(
          comClique.sessaoId,
          utmOficial.sessaoId,
          naoVerificado.sessaoId
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
          sessao_id:
            naoVerificado.sessaoId,
        });
      }
    );

    test(
      "recupera clique anônimo pré-cadastro pela mesma sessão sem cruzar outra sessão",
      async () => {
        const alvo =
          await criarProfissional("AnonimoAlvo");
        const outro =
          await criarProfissional("AnonimoOutro");

        usuarios.push(
          alvo.usuarioId,
          outro.usuarioId
        );
        sessoes.push(
          alvo.sessaoId,
          outro.sessaoId
        );

        const criacao = await db.query(
          `
          SELECT created_at
          FROM usuarios
          WHERE id = $1
          `,
          [alvo.usuarioId]
        );
        const momentoAntes = new Date(
          new Date(criacao.rows[0].created_at).getTime() -
            (30 * 60 * 1000)
        ).toISOString();

        await registrarEvento({
          usuarioId: null,
          sessaoId: alvo.sessaoId,
          momento: momentoAntes,
          propriedades: {
            gclid: `gclid-anonimo-${suffix()}`,
            utm_source: "google",
            utm_medium: "cpc",
            landing_page: "/para-profissionais",
          },
        });

        await registrarEvento({
          usuarioId: null,
          sessaoId: `sessao_nao_relacionada_${suffix()}`,
          momento: momentoAntes,
          propriedades: {
            gclid: `gclid-errado-${suffix()}`,
            utm_source: "google",
            utm_medium: "cpc",
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
          .toBeGreaterThanOrEqual(1);

        const atribuicoes = await db.query(
          `
          SELECT
            usuario_id,
            utm_source,
            utm_medium,
            gclid
          FROM marketing_usuario_atribuicoes
          WHERE usuario_id = ANY($1::BIGINT[])
          ORDER BY usuario_id
          `,
          [[alvo.usuarioId, outro.usuarioId]]
        );

        const porUsuario = new Map(
          atribuicoes.rows.map((item) => [
            Number(item.usuario_id),
            item,
          ])
        );

        expect(
          porUsuario.get(alvo.usuarioId)
        ).toMatchObject({
          utm_source: "google",
          utm_medium: "cpc",
        });
        expect(
          porUsuario.get(alvo.usuarioId).gclid
        ).toMatch(/^gclid-anonimo-/);

        expect(
          porUsuario.get(outro.usuarioId)
        ).toMatchObject({
          utm_source: null,
          utm_medium: null,
          gclid: null,
        });
      }
    );
  }
);
