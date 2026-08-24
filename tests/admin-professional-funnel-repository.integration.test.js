const crypto = require(
  "crypto"
);

const db = require(
  "../src/db/db"
);

const repository = require(
  "../src/repositories/adminProfessionalFunnelRepository"
);

function idCurto() {
  return crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "adminProfessionalFunnelRepository integrado",
  () => {
    let usuarioId;
    let negocioId;
    let campanhaId;
    let assinaturaId;
    let utmCampaign;
    let valorPrimeiroPagamentoCentavos;

    beforeEach(async () => {
      const suffix = idCurto();
      utmCampaign =
        `prof_${suffix}`;

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
          RETURNING id
          `,
          [
            `Profissional ${suffix}`,
            `prof-${suffix}@example.com`,
          ]
        );

      usuarioId = Number(
        usuario.rows[0].id
      );

      await db.query(
        `
        INSERT INTO marketing_usuario_atribuicoes (
          usuario_id,
          intencao,
          sessao_id,
          utm_source,
          utm_medium,
          utm_campaign,
          landing_page,
          atribuicao_em
        )
        VALUES (
          $1,
          'profissional',
          $2,
          'meta',
          'cpc',
          $3,
          '/cadastro',
          NOW()
        )
        `,
        [
          usuarioId,
          `sessao_${suffix}`,
          utmCampaign,
        ]
      );

      const campanha =
        await db.query(
          `
          INSERT INTO marketing_campanhas (
            nome,
            canal,
            objetivo,
            utm_source,
            utm_medium,
            utm_campaign,
            destino_path,
            ativo
          )
          VALUES (
            $1,
            'meta',
            'profissional',
            'meta',
            'cpc',
            $2,
            '/cadastro?tipo=profissional',
            TRUE
          )
          RETURNING id
          `,
          [
            `Aquisição ${suffix}`,
            utmCampaign,
          ]
        );

      campanhaId = Number(
        campanha.rows[0].id
      );

      await db.query(
        `
        INSERT INTO marketing_campanha_gastos (
          campanha_id,
          data_gasto,
          valor_centavos,
          moeda,
          fonte
        )
        VALUES (
          $1,
          CURRENT_DATE,
          12000,
          'BRL',
          'manual'
        )
        `,
        [campanhaId]
      );

      const negocio =
        await db.query(
          `
          INSERT INTO negocios (
            nome,
            slug,
            descricao,
            setor,
            whatsapp,
            cidade,
            estado,
            publicado
          )
          VALUES (
            $1,
            $2,
            'Negócio criado pelo teste integrado.',
            'cilios',
            '62999999999',
            'Goiânia',
            'GO',
            FALSE
          )
          RETURNING id
          `,
          [
            `Studio ${suffix}`,
            `studio-${suffix}`,
          ]
        );

      negocioId = Number(
        negocio.rows[0].id
      );

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

      await db.query(
        `
        INSERT INTO servicos_negocio (
          negocio_id,
          nome,
          valor,
          duracao_minutos,
          ativo
        )
        VALUES (
          $1,
          'Extensão de cílios',
          120,
          60,
          TRUE
        )
        `,
        [negocioId]
      );

      await db.query(
        `
        INSERT INTO agenda_configuracoes (
          profissional_id,
          duracao_padrao,
          intervalo_minutos,
          antecedencia_agendamento,
          antecedencia_cancelamento,
          configurado_em
        )
        VALUES (
          $1,
          60,
          0,
          0,
          24,
          NOW()
        )
        `,
        [usuarioId]
      );

      await db.query(
        `
        UPDATE negocios
        SET publicado = TRUE
        WHERE id = $1
        `,
        [negocioId]
      );

      await db.query(
        `
        INSERT INTO checkout_tentativas (
          negocio_id,
          chave_idempotencia,
          request_hash,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          'COMPLETED'
        )
        `,
        [
          negocioId,
          `checkout-${suffix}-123456`,
          "a".repeat(64),
        ]
      );

      const plano =
        await db.query(
          `
          SELECT id, valor
          FROM planos
          WHERE slug = 'autonoma'
          LIMIT 1
          `
        );

      valorPrimeiroPagamentoCentavos =
        Math.round(
          Number(plano.rows[0].valor) * 100
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
            plano.rows[0].id,
            plano.rows[0].valor,
          ]
        );

      assinaturaId = Number(
        assinatura.rows[0].id
      );

      await db.query(
        `
        INSERT INTO pagamentos (
          assinatura_id,
          asaas_payment_id,
          valor,
          forma_pagamento,
          status,
          data_pagamento
        )
        VALUES (
          $1,
          $2,
          $3,
          'pix',
          'CONFIRMED',
          CURRENT_DATE
        )
        `,
        [
          assinaturaId,
          `pay_${suffix}`,
          plano.rows[0].valor,
        ]
      );
    });

    afterEach(async () => {
      await db.query(
        `
        DELETE FROM marketing_campanha_gastos
        WHERE campanha_id = $1
        `,
        [campanhaId]
      );

      await db.query(
        `
        DELETE FROM marketing_campanhas
        WHERE id = $1
        `,
        [campanhaId]
      );

      await db.query(
        `
        DELETE FROM negocios
        WHERE id = $1
        `,
        [negocioId]
      );

      await db.query(
        `
        DELETE FROM usuarios
        WHERE id = $1
        `,
        [usuarioId]
      );
    });

    test(
      "atravessa todos os marcos e relaciona investimento e receita pela UTM",
      async () => {
        const linhas =
          await repository
            .listarPorCampanha("today");

        const encontrada =
          linhas.find(
            (item) =>
              item.campanha ===
              utmCampaign
          );

        expect(encontrada)
          .toMatchObject({
            origem: "meta",
            midia: "cpc",
            campanha: utmCampaign,
            campanha_oficial_id:
              campanhaId,
            classificacao_atribuicao:
              "oficial",
            cadastros: 1,
            negocios_criados: 1,
            servicos_criados: 1,
            agendas_configuradas: 1,
            negocios_publicados: 1,
            checkouts_iniciados: 1,
            assinaturas_ativadas: 1,
            investimento_centavos: "12000",
            receita_primeiro_pagamento_centavos:
              String(
                valorPrimeiroPagamentoCentavos
              ),
          });
      }
    );

    test(
      "mantém o primeiro pagamento da aquisição como referência após reembolso",
      async () => {
        const valorRenovacaoCentavos =
          valorPrimeiroPagamentoCentavos +
          1000;

        await db.query(
          `
          INSERT INTO pagamentos (
            assinatura_id,
            asaas_payment_id,
            valor,
            forma_pagamento,
            status,
            data_pagamento
          )
          VALUES (
            $1,
            $2,
            $3,
            'pix',
            'RECEIVED',
            CURRENT_DATE
          )
          `,
          [
            assinaturaId,
            `pay_${idCurto()}`,
            valorRenovacaoCentavos / 100,
          ]
        );

        let linhas =
          await repository
            .listarPorCampanha("today");

        let encontrada =
          linhas.find(
            (item) =>
              item.campanha ===
              utmCampaign
          );

        expect(encontrada)
          .toMatchObject({
            assinaturas_ativadas: 1,
            receita_primeiro_pagamento_centavos:
              String(
                valorPrimeiroPagamentoCentavos
              ),
          });

        await db.query(
          `
          UPDATE pagamentos
          SET status = 'REFUNDED'
          WHERE assinatura_id = $1
            AND id = (
              SELECT MIN(id)
              FROM pagamentos
              WHERE assinatura_id = $1
            )
          `,
          [assinaturaId]
        );

        linhas =
          await repository
            .listarPorCampanha("today");

        encontrada =
          linhas.find(
            (item) =>
              item.campanha ===
              utmCampaign
          );

        expect(encontrada)
          .toMatchObject({
            assinaturas_ativadas: 0,
            receita_primeiro_pagamento_centavos:
              "0",
          });
      }
    );

    test(
      "preserva marcos de serviço e publicação depois de mudanças de estado",
      async () => {
        await db.query(
          `
          DELETE FROM servicos_negocio
          WHERE negocio_id = $1
          `,
          [negocioId]
        );

        await db.query(
          `
          UPDATE negocios
          SET publicado = FALSE
          WHERE id = $1
          `,
          [negocioId]
        );

        const linhas =
          await repository
            .listarPorCampanha("today");

        const encontrada =
          linhas.find(
            (item) =>
              item.campanha ===
              utmCampaign
          );

        expect(encontrada)
          .toMatchObject({
            servicos_criados: 1,
            negocios_publicados: 1,
          });
      }
    );
  }
);
