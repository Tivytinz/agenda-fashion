const crypto = require("crypto");
const db = require("../src/db/db");
const repository = require(
  "../src/repositories/assinaturaEventoRepository"
);

describe("assinatura_eventos - integração", () => {
  let negocioId;

  afterEach(async () => {
    if (negocioId) {
      await db.query(
        "DELETE FROM negocios WHERE id = $1",
        [negocioId]
      );
    }
    negocioId = null;
  });

  afterAll(() => db.end());

  test("registra lifecycle append-only e ignora duplicação pela chave idempotente", async () => {
    const suffix = crypto.randomUUID()
      .replaceAll("-", "")
      .slice(0, 12);

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
        `Wave 22 ${suffix}`,
        `wave-22-${suffix}`,
      ]
    );
    negocioId = Number(negocio.rows[0].id);

    const plano = await db.query(
      `
      SELECT id, valor
      FROM planos
      WHERE slug = 'autonoma'
      LIMIT 1
      `
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
        `pay_wave22_${suffix}`,
        plano.rows[0].valor,
      ]
    );

    const dados = {
      negocioId,
      assinaturaId: assinatura.rows[0].id,
      pagamentoId: pagamento.rows[0].id,
      tipo: "CONVERSAO_INICIAL",
      planoNovoId: plano.rows[0].id,
      origem: "webhook",
      valorMensalAnterior: 0,
      valorMensalNovo: Number(plano.rows[0].valor),
      periodicidadeSnapshot: "MONTHLY",
      chaveIdempotencia:
        `wave22:${suffix}:conversao`,
    };

    const primeiro = await repository.registrar(
      db,
      dados
    );
    const duplicado = await repository.registrar(
      db,
      dados
    );

    expect(primeiro).toMatchObject({
      negocio_id: negocioId,
      tipo: "CONVERSAO_INICIAL",
      origem: "webhook",
      valor_mensal_anterior: "0.00",
      valor_mensal_novo:
        Number(plano.rows[0].valor).toFixed(2),
      periodicidade_snapshot: "MONTHLY",
    });
    expect(duplicado).toBeNull();

    const contagem = await db.query(
      `
      SELECT COUNT(*)::INT AS total
      FROM assinatura_eventos
      WHERE chave_idempotencia = $1
      `,
      [dados.chaveIdempotencia]
    );

    expect(contagem.rows[0].total).toBe(1);
  });
});
