const crypto = require("crypto");
const db = require("../src/db/db");
const assinaturaRepository = require(
  "../src/repositories/assinaturaRepository"
);
const planoService = require(
  "../src/services/planoService"
);
const {
  buscarReceita,
} = require(
  "../src/repositories/adminAnalyticsV2Repository"
);

describe("Wave 23 - reconciliação temporal integrada", () => {
  let negocioId;

  afterEach(async () => {
    if (!negocioId) return;

    await db.query(
      "DELETE FROM assinatura_eventos WHERE negocio_id = $1",
      [negocioId]
    );
    await db.query(
      "DELETE FROM assinaturas WHERE negocio_id = $1",
      [negocioId]
    );
    await db.query(
      "DELETE FROM negocios WHERE id = $1",
      [negocioId]
    );
    negocioId = null;
  });

  afterAll(() => db.end());

  test(
    "expira período pago sem navegação, registra uma única saída e remove a pendência administrativa",
    async () => {
      const suffix = crypto.randomUUID()
        .replaceAll("-", "")
        .slice(0, 12);
      const planos = await db.query(
        `
        SELECT id, slug, valor
        FROM planos
        WHERE slug IN ('inicial', 'autonoma')
        `
      );
      const gratis = planos.rows.find(
        (item) => item.slug === "inicial"
      );
      const pago = planos.rows.find(
        (item) => item.slug === "autonoma"
      );

      const baseAntes = await buscarReceita("all");

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
          `Wave 23 ${suffix}`,
          `wave-23-${suffix}`,
          pago.id,
        ]
      );
      negocioId = Number(negocio.rows[0].id);

      const assinatura = await db.query(
        `
        INSERT INTO assinaturas (
          negocio_id,
          plano_id,
          status,
          forma_pagamento,
          periodicidade,
          valor,
          data_proxima_cobranca,
          ativo,
          observacoes
        )
        VALUES (
          $1,
          $2,
          'CANCELED',
          'pix',
          'MONTHLY',
          $3,
          CURRENT_DATE - 1,
          TRUE,
          'Renovação cancelada pelo titular.'
        )
        RETURNING id
        `,
        [
          negocioId,
          pago.id,
          pago.valor,
        ]
      );
      const assinaturaId = Number(
        assinatura.rows[0].id
      );

      const candidatos =
        await assinaturaRepository
          .listarNegociosComCancelamentoExpirado(
            100,
            db
          );

      expect(candidatos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            negocio_id: negocioId,
          }),
        ])
      );

      const antesReconciliacao =
        await buscarReceita("all");
      expect(
        Number(
          antesReconciliacao.resumo
            .cancelamentos_vencidos_pendentes_reconciliacao
        ) -
        Number(
          baseAntes.resumo
            .cancelamentos_vencidos_pendentes_reconciliacao
        )
      ).toBe(1);
      expect(
        Number(
          antesReconciliacao.resumo
            .assinaturas_pagas_ativas
        ) -
        Number(
          baseAntes.resumo
            .assinaturas_pagas_ativas
        )
      ).toBe(0);

      const expirada =
        await planoService
          .expirarCancelamentoComReconciliacao(
            negocioId
          );

      expect(expirada).toMatchObject({
        id: assinaturaId,
        negocio_id: negocioId,
        ativo: false,
      });

      const estado = await db.query(
        `
        SELECT
          n.plano_id,
          a.ativo
        FROM negocios n
        INNER JOIN assinaturas a
          ON a.negocio_id = n.id
        WHERE n.id = $1
          AND a.id = $2
        `,
        [negocioId, assinaturaId]
      );

      expect(Number(estado.rows[0].plano_id))
        .toBe(Number(gratis.id));
      expect(estado.rows[0].ativo).toBe(false);

      const lifecycle = await db.query(
        `
        SELECT tipo, motivo
        FROM assinatura_eventos
        WHERE negocio_id = $1
          AND assinatura_id = $2
          AND tipo = 'ACESSO_PAGO_ENCERRADO'
        `,
        [negocioId, assinaturaId]
      );

      expect(lifecycle.rows).toHaveLength(1);
      expect(lifecycle.rows[0]).toMatchObject({
        tipo: "ACESSO_PAGO_ENCERRADO",
        motivo: "ENCERRAMENTO_RECORRENCIA",
      });

      await expect(
        planoService
          .expirarCancelamentoComReconciliacao(
            negocioId
          )
      ).resolves.toBeNull();

      const lifecycleDepois = await db.query(
        `
        SELECT COUNT(*)::INT AS total
        FROM assinatura_eventos
        WHERE negocio_id = $1
          AND assinatura_id = $2
          AND tipo = 'ACESSO_PAGO_ENCERRADO'
        `,
        [negocioId, assinaturaId]
      );
      expect(lifecycleDepois.rows[0].total).toBe(1);

      const depois = await buscarReceita("all");
      expect(
        Number(
          depois.resumo
            .cancelamentos_vencidos_pendentes_reconciliacao
        ) -
        Number(
          baseAntes.resumo
            .cancelamentos_vencidos_pendentes_reconciliacao
        )
      ).toBe(0);
    }
  );
});
