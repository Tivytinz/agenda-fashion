const crypto = require("crypto");
const db = require("../src/db/db");
const repository = require(
  "../src/repositories/aquisicaoFinanceiraRepository"
);

function suffix() {
  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "Wave 27 - snapshot de aquisição financeira",
  () => {
    const negocios = [];
    const usuarios = [];
    const campanhas = [];

    afterEach(async () => {
      for (
        const negocioId of
        negocios.splice(0)
      ) {
        await db.query(
          "DELETE FROM marketing_negocio_aquisicoes WHERE negocio_id = $1",
          [negocioId]
        );
        await db.query(
          "DELETE FROM assinatura_eventos WHERE negocio_id = $1",
          [negocioId]
        );
        await db.query(
          `
          DELETE FROM pagamentos
          WHERE assinatura_id IN (
            SELECT id
            FROM assinaturas
            WHERE negocio_id = $1
          )
          `,
          [negocioId]
        );
        await db.query(
          "DELETE FROM assinaturas WHERE negocio_id = $1",
          [negocioId]
        );
        await db.query(
          "DELETE FROM usuarios_negocios WHERE negocio_id = $1",
          [negocioId]
        );
        await db.query(
          "DELETE FROM negocios WHERE id = $1",
          [negocioId]
        );
      }

      for (
        const usuarioId of
        usuarios.splice(0)
      ) {
        await db.query(
          "DELETE FROM marketing_usuario_atribuicoes WHERE usuario_id = $1",
          [usuarioId]
        );
        await db.query(
          "DELETE FROM usuarios WHERE id = $1",
          [usuarioId]
        );
      }

      for (
        const campanhaId of
        campanhas.splice(0)
      ) {
        await db.query(
          "DELETE FROM marketing_campanha_gastos WHERE campanha_id = $1",
          [campanhaId]
        );
        await db.query(
          "DELETE FROM marketing_campanhas WHERE id = $1",
          [campanhaId]
        );
      }
    });

    afterAll(() => db.end());

    async function criarUsuario(prefixo) {
      const id = suffix();
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
          '62999999999'
        )
        RETURNING id
        `,
        [
          `${prefixo} ${id}`,
          `wave27-${id}@example.com`,
        ]
      );

      const usuarioId = Number(
        resultado.rows[0].id
      );
      usuarios.push(usuarioId);
      return usuarioId;
    }

    test(
      "congela primeiro dono e campanha e não duplica em retry",
      async () => {
        const planos = await db.query(
          `
          SELECT id, slug, valor
          FROM planos
          WHERE slug IN (
            'inicial',
            'autonoma'
          )
          `
        );
        const gratis = planos.rows.find(
          (item) =>
            item.slug === "inicial"
        );
        const pago = planos.rows.find(
          (item) =>
            item.slug === "autonoma"
        );
        const campanhaUtm =
          `wave27_${suffix()}`;

        const campanha = await db.query(
          `
          INSERT INTO marketing_campanhas (
            nome,
            canal,
            utm_source,
            utm_medium,
            utm_campaign,
            destino_path,
            objetivo
          )
          VALUES (
            'Wave 27 Google',
            'google',
            'google',
            'cpc',
            $1,
            '/profissionais',
            'profissional'
          )
          RETURNING id
          `,
          [campanhaUtm]
        );
        const campanhaId = Number(
          campanha.rows[0].id
        );
        campanhas.push(campanhaId);

        const primeiroDono =
          await criarUsuario(
            "Primeiro dono"
          );
        const donoAtual =
          await criarUsuario(
            "Dono atual"
          );

        await db.query(
          `
          INSERT INTO marketing_usuario_atribuicoes (
            usuario_id,
            intencao,
            utm_source,
            utm_medium,
            utm_campaign,
            atribuicao_em
          )
          VALUES (
            $1,
            'profissional',
            'google',
            'cpc',
            $2,
            NOW() - INTERVAL '2 days'
          )
          ON CONFLICT (usuario_id)
          DO UPDATE SET
            intencao = 'profissional',
            utm_source = EXCLUDED.utm_source,
            utm_medium = EXCLUDED.utm_medium,
            utm_campaign = EXCLUDED.utm_campaign,
            atribuicao_em = EXCLUDED.atribuicao_em
          `,
          [
            primeiroDono,
            campanhaUtm,
          ]
        );

        const negocioToken = suffix();
        const negocio = await db.query(
          `
          INSERT INTO negocios (
            nome,
            slug,
            setor,
            whatsapp,
            cidade,
            estado,
            publicado,
            plano_id
          )
          VALUES (
            $1,
            $2,
            'unhas',
            '62999999999',
            'Goiânia',
            'GO',
            TRUE,
            $3
          )
          RETURNING id
          `,
          [
            `Wave 27 ${negocioToken}`,
            `wave-27-${negocioToken}`,
            gratis.id,
          ]
        );
        const negocioId = Number(
          negocio.rows[0].id
        );
        negocios.push(negocioId);

        await db.query(
          `
          INSERT INTO usuarios_negocios (
            usuario_id,
            negocio_id,
            papel,
            ativo
          )
          VALUES (
            $1,
            $2,
            'dono',
            TRUE
          )
          `,
          [
            primeiroDono,
            negocioId,
          ]
        );

        await db.query(
          `
          UPDATE usuarios_negocios
          SET ativo = FALSE
          WHERE usuario_id = $1
            AND negocio_id = $2
          `,
          [
            primeiroDono,
            negocioId,
          ]
        );

        await db.query(
          `
          INSERT INTO usuarios_negocios (
            usuario_id,
            negocio_id,
            papel,
            ativo
          )
          VALUES (
            $1,
            $2,
            'dono',
            TRUE
          )
          `,
          [
            donoAtual,
            negocioId,
          ]
        );

        const assinatura =
          await db.query(
            `
            INSERT INTO assinaturas (
              negocio_id,
              plano_id,
              status,
              forma_pagamento,
              periodicidade,
              valor,
              ativo
            )
            VALUES (
              $1,
              $2,
              'ACTIVE',
              'pix',
              'MONTHLY',
              $3,
              TRUE
            )
            RETURNING id
            `,
            [
              negocioId,
              pago.id,
              pago.valor,
            ]
          );

        const pagamento =
          await db.query(
            `
            INSERT INTO pagamentos (
              assinatura_id,
              asaas_payment_id,
              valor,
              forma_pagamento,
              status,
              data_vencimento,
              data_pagamento
            )
            VALUES (
              $1,
              $2,
              $3,
              'pix',
              'RECEIVED',
              CURRENT_DATE,
              CURRENT_DATE
            )
            RETURNING id
            `,
            [
              assinatura.rows[0].id,
              `pay_wave27_${suffix()}`,
              pago.valor,
            ]
          );

        const evento =
          await db.query(
            `
            INSERT INTO assinatura_eventos (
              negocio_id,
              assinatura_id,
              pagamento_id,
              tipo,
              plano_novo_id,
              origem,
              chave_idempotencia
            )
            VALUES (
              $1,
              $2,
              $3,
              'CONVERSAO_INICIAL',
              $4,
              'webhook',
              $5
            )
            RETURNING id
            `,
            [
              negocioId,
              assinatura.rows[0].id,
              pagamento.rows[0].id,
              pago.id,
              `test:wave27:${negocioId}:conversao`,
            ]
          );

        const pendentes =
          await repository
            .listarConversoesPendentes(
              100
            );

        expect(
          pendentes.some(
            (item) =>
              Number(item.evento_id) ===
              Number(
                evento.rows[0].id
              )
          )
        ).toBe(true);

        const snapshot =
          await repository
            .materializarAquisicaoPorEvento(
              evento.rows[0].id
            );

        expect({
          ...snapshot,
          negocio_id:
            Number(snapshot.negocio_id),
          usuario_aquisicao_id:
            Number(
              snapshot.usuario_aquisicao_id
            ),
          campanha_oficial_id:
            Number(
              snapshot.campanha_oficial_id
            ),
          primeiro_pagamento_id:
            Number(
              snapshot.primeiro_pagamento_id
            ),
          plano_entrada_id:
            Number(
              snapshot.plano_entrada_id
            ),
        }).toMatchObject({
          negocio_id: negocioId,
          usuario_aquisicao_id:
            primeiroDono,
          campanha_oficial_id:
            campanhaId,
          primeiro_pagamento_id:
            Number(
              pagamento.rows[0].id
            ),
          plano_entrada_id:
            Number(pago.id),
          classificacao_atribuicao:
            "oficial",
          metodo_resolucao:
            "utm_exata",
          origem: "google",
          midia: "cpc",
          campanha: campanhaUtm,
        });

        await expect(
          repository
            .materializarAquisicaoPorEvento(
              evento.rows[0].id
            )
        ).resolves.toBeNull();

        await db.query(
          `
          UPDATE marketing_usuario_atribuicoes
          SET utm_campaign =
            'campanha_corrigida_depois'
          WHERE usuario_id = $1
          `,
          [primeiroDono]
        );

        const persistido = await db.query(
          `
          SELECT
            usuario_aquisicao_id,
            campanha_oficial_id,
            campanha
          FROM marketing_negocio_aquisicoes
          WHERE negocio_id = $1
          `,
          [negocioId]
        );

        expect(
          persistido.rows[0]
        ).toMatchObject({
          usuario_aquisicao_id:
            primeiroDono,
          campanha_oficial_id:
            campanhaId,
          campanha: campanhaUtm,
        });

        await expect(
          repository.contarPendentes()
        ).resolves.toBeGreaterThanOrEqual(
          0
        );
        const depois =
          await repository
            .listarConversoesPendentes(
              100
            );
        expect(
          depois.some(
            (item) =>
              Number(item.negocio_id) ===
              negocioId
          )
        ).toBe(false);
      }
    );
    test(
      "não promove atribuição posterior à conversão para campanha financeira",
      async () => {
        const planos = await db.query(
          `
          SELECT id, slug, valor
          FROM planos
          WHERE slug IN (
            'inicial',
            'autonoma'
          )
          `
        );
        const gratis = planos.rows.find(
          (item) =>
            item.slug === "inicial"
        );
        const pago = planos.rows.find(
          (item) =>
            item.slug === "autonoma"
        );
        const campanhaUtm =
          `wave27_late_${suffix()}`;

        const campanha = await db.query(
          `
          INSERT INTO marketing_campanhas (
            nome,
            canal,
            utm_source,
            utm_medium,
            utm_campaign,
            destino_path,
            objetivo
          )
          VALUES (
            'Wave 27 late',
            'google',
            'google',
            'cpc',
            $1,
            '/profissionais',
            'profissional'
          )
          RETURNING id
          `,
          [campanhaUtm]
        );
        campanhas.push(
          Number(campanha.rows[0].id)
        );

        const usuario =
          await criarUsuario(
            "Dono late"
          );

        await db.query(
          `
          INSERT INTO marketing_usuario_atribuicoes (
            usuario_id,
            intencao,
            utm_source,
            utm_medium,
            utm_campaign,
            atribuicao_em
          )
          VALUES (
            $1,
            'profissional',
            'google',
            'cpc',
            $2,
            NOW() + INTERVAL '1 day'
          )
          ON CONFLICT (usuario_id)
          DO UPDATE SET
            intencao = 'profissional',
            utm_source = EXCLUDED.utm_source,
            utm_medium = EXCLUDED.utm_medium,
            utm_campaign = EXCLUDED.utm_campaign,
            atribuicao_em = EXCLUDED.atribuicao_em
          `,
          [usuario, campanhaUtm]
        );

        const token = suffix();
        const negocio = await db.query(
          `
          INSERT INTO negocios (
            nome,
            slug,
            setor,
            whatsapp,
            cidade,
            estado,
            publicado,
            plano_id
          )
          VALUES (
            $1,
            $2,
            'unhas',
            '62999999999',
            'Goiânia',
            'GO',
            TRUE,
            $3
          )
          RETURNING id
          `,
          [
            `Wave 27 late ${token}`,
            `wave-27-late-${token}`,
            gratis.id,
          ]
        );
        const negocioId = Number(
          negocio.rows[0].id
        );
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
          [usuario, negocioId]
        );

        const assinatura = await db.query(
          `
          INSERT INTO assinaturas (
            negocio_id,
            plano_id,
            status,
            forma_pagamento,
            periodicidade,
            valor,
            ativo
          )
          VALUES (
            $1,
            $2,
            'ACTIVE',
            'pix',
            'MONTHLY',
            $3,
            TRUE
          )
          RETURNING id
          `,
          [
            negocioId,
            pago.id,
            pago.valor,
          ]
        );

        const pagamento = await db.query(
          `
          INSERT INTO pagamentos (
            assinatura_id,
            asaas_payment_id,
            valor,
            forma_pagamento,
            status,
            data_vencimento,
            data_pagamento
          )
          VALUES (
            $1,
            $2,
            $3,
            'pix',
            'RECEIVED',
            CURRENT_DATE,
            CURRENT_DATE
          )
          RETURNING id
          `,
          [
            assinatura.rows[0].id,
            `pay_wave27_late_${suffix()}`,
            pago.valor,
          ]
        );

        const evento = await db.query(
          `
          INSERT INTO assinatura_eventos (
            negocio_id,
            assinatura_id,
            pagamento_id,
            tipo,
            plano_novo_id,
            origem,
            chave_idempotencia
          )
          VALUES (
            $1,
            $2,
            $3,
            'CONVERSAO_INICIAL',
            $4,
            'webhook',
            $5
          )
          RETURNING id
          `,
          [
            negocioId,
            assinatura.rows[0].id,
            pagamento.rows[0].id,
            pago.id,
            `test:wave27:${negocioId}:late`,
          ]
        );

        const snapshot =
          await repository
            .materializarAquisicaoPorEvento(
              evento.rows[0].id
            );

        expect(snapshot)
          .toMatchObject({
            classificacao_atribuicao:
              "sem_evidencia",
            campanha_oficial_id: null,
            metodo_resolucao: null,
            origem: "desconhecida",
            midia: "desconhecida",
            campanha: "(sem campanha)",
            atribuicao_em: null,
          });
        expect(
          snapshot.detalhes
            .atribuicao_posterior_conversao
        ).toBe(true);
      }
    );

  }
);
