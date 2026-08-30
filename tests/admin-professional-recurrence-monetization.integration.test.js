const crypto = require(
  "crypto"
);

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/adminProfessionalRecurrenceRepository"
);

function idCurto() {
  return crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe(
  "monetização no repository de recorrência",
  () => {
    let usuarioId;
    let negocioId;
    let campanhaId;
    let assinaturaId;
    let primeiroPagamentoId;
    let utmCampaign;
    let valorPrimeiroCentavos;

    beforeEach(async () => {
      const suffix = idCurto();
      utmCampaign =
        `rec_monet_${suffix}`;

      const usuario = await db.query(
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
          `Recorrência monetização ${suffix}`,
          `rec-monet-${suffix}@example.com`,
        ]
      );
      usuarioId = Number(
        usuario.rows[0].id
      );

      const campanha = await db.query(
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
          'google',
          'profissional',
          'google',
          'cpc',
          $2,
          '/para-profissionais',
          TRUE
        )
        RETURNING id
        `,
        [
          `Recorrência monetização ${suffix}`,
          utmCampaign,
        ]
      );
      campanhaId = Number(
        campanha.rows[0].id
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
          'google',
          'cpc',
          $3,
          '/para-profissionais',
          NOW() - INTERVAL '40 days'
        )
        `,
        [
          usuarioId,
          `sessao_${suffix}`,
          utmCampaign,
        ]
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
          TRUE
        )
        RETURNING id
        `,
        [
          `Studio monetização ${suffix}`,
          `studio-monet-${suffix}`,
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

      const plano = await db.query(
        `
        SELECT id, valor
        FROM planos
        WHERE slug = 'autonoma'
        LIMIT 1
        `
      );
      valorPrimeiroCentavos =
        Math.round(
          Number(plano.rows[0].valor) * 100
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
          plano.rows[0].id,
          plano.rows[0].valor,
        ]
      );
      assinaturaId = Number(
        assinatura.rows[0].id
      );

      const primeiroPagamento =
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
            CURRENT_DATE - 30
          )
          RETURNING id
          `,
          [
            assinaturaId,
            `pay_primeiro_${suffix}`,
            plano.rows[0].valor,
          ]
        );
      primeiroPagamentoId = Number(
        primeiroPagamento.rows[0].id
      );
    });

    afterEach(async () => {
      if (assinaturaId) {
        await db.query(
          `DELETE FROM pagamentos WHERE assinatura_id = $1`,
          [assinaturaId]
        );
        await db.query(
          `DELETE FROM assinaturas WHERE id = $1`,
          [assinaturaId]
        );
      }

      if (negocioId) {
        await db.query(
          `DELETE FROM usuarios_negocios WHERE negocio_id = $1`,
          [negocioId]
        );
        await db.query(
          `DELETE FROM negocios WHERE id = $1`,
          [negocioId]
        );
      }

      if (usuarioId) {
        await db.query(
          `DELETE FROM marketing_usuario_atribuicoes WHERE usuario_id = $1`,
          [usuarioId]
        );
        await db.query(
          `DELETE FROM usuarios WHERE id = $1`,
          [usuarioId]
        );
      }

      if (campanhaId) {
        await db.query(
          `DELETE FROM marketing_campanhas WHERE id = $1`,
          [campanhaId]
        );
      }
    });

    async function buscarLinha() {
      const resultado =
        await repository.listarRecorrencia("all");

      return resultado.linhas.find(
        (linha) =>
          Number(linha.usuario_id) === usuarioId
      );
    }

    test(
      "mantém o primeiro pagamento da aquisição e não o substitui por renovação",
      async () => {
        let linha = await buscarLinha();

        expect(linha).toMatchObject({
          classificacao_atribuicao: "oficial",
          campanha_oficial_id:
            String(campanhaId),
          pagamento_inicial_valido: true,
          receita_primeiro_pagamento_centavos:
            String(valorPrimeiroCentavos),
        });
        const primeiroPagamentoEm =
          new Date(
            linha.primeiro_pagamento_em
          ).getTime();

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
            CURRENT_DATE - 20
          )
          `,
          [
            assinaturaId,
            `pay_renovacao_${idCurto()}`,
            (valorPrimeiroCentavos + 1000) / 100,
          ]
        );

        linha = await buscarLinha();

        expect(linha).toMatchObject({
          pagamento_inicial_valido: true,
          receita_primeiro_pagamento_centavos:
            String(valorPrimeiroCentavos),
        });
        expect(
          new Date(
            linha.primeiro_pagamento_em
          ).getTime()
        ).toBe(primeiroPagamentoEm);

        await db.query(
          `
          UPDATE pagamentos
          SET status = 'REFUNDED'
          WHERE id = $1
          `,
          [primeiroPagamentoId]
        );

        linha = await buscarLinha();

        expect(linha).toMatchObject({
          pagamento_inicial_valido: false,
          receita_primeiro_pagamento_centavos:
            "0",
        });
        expect(
          new Date(
            linha.primeiro_pagamento_em
          ).getTime()
        ).toBe(primeiroPagamentoEm);
      }
    );
  }
);
