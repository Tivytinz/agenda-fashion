const crypto = require("crypto");
const db = require("../src/db/db");
const {
  buscarLtvObservado,
} = require(
  "../src/repositories/adminAnalyticsV2Repository"
);

function suffix() {
  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

function somar(coortes, campo) {
  return (coortes || []).reduce(
    (total, coorte) =>
      total + Number(coorte[campo] || 0),
    0
  );
}

describe("Wave 26 - LTV bruto observado", () => {
  const negocios = [];
  let marcoOriginal = null;

  beforeAll(async () => {
    const marco = await db.query(
      `
      SELECT ocorrido_em
      FROM financeiro_marcos
      WHERE chave = 'ltv_v1_inicio'
      `
    );

    expect(marco.rows).toHaveLength(1);
    marcoOriginal = marco.rows[0].ocorrido_em;

    await db.query(
      `
      UPDATE financeiro_marcos
      SET ocorrido_em =
        NOW() - INTERVAL '120 days'
      WHERE chave = 'ltv_v1_inicio'
      `
    );
  });

  afterEach(async () => {
    for (const negocioId of negocios.splice(0)) {
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
        "DELETE FROM negocios WHERE id = $1",
        [negocioId]
      );
    }
  });

  afterAll(async () => {
    if (marcoOriginal) {
      await db.query(
        `
        UPDATE financeiro_marcos
        SET ocorrido_em = $1
        WHERE chave = 'ltv_v1_inicio'
        `,
        [marcoOriginal]
      );
    }

    await db.end();
  });

  async function criarNegocio(planoId, prefixo) {
    const id = suffix();
    const resultado = await db.query(
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
        `${prefixo} ${id}`,
        `wave-26-${id}`,
        planoId,
      ]
    );

    const negocioId = Number(
      resultado.rows[0].id
    );
    negocios.push(negocioId);
    return negocioId;
  }

  async function criarAssinatura({
    negocioId,
    planoId,
    valor,
    status = "INACTIVE",
    ativo = false,
  }) {
    const resultado = await db.query(
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
        $3,
        'pix',
        'MONTHLY',
        $4,
        $5
      )
      RETURNING id
      `,
      [
        negocioId,
        planoId,
        status,
        valor,
        ativo,
      ]
    );

    return Number(resultado.rows[0].id);
  }

  async function criarPagamento({
    assinaturaId,
    valor,
    diasAtras,
    status = "RECEIVED",
  }) {
    const resultado = await db.query(
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
        $4,
        CURRENT_DATE - $5::INT,
        CURRENT_DATE - $5::INT
      )
      RETURNING id
      `,
      [
        assinaturaId,
        `pay_wave26_${suffix()}`,
        valor,
        status,
        diasAtras,
      ]
    );

    return Number(resultado.rows[0].id);
  }

  async function registrarEvento({
    negocioId,
    assinaturaId,
    pagamentoId = null,
    tipo,
    planoId,
    diasAtras,
    chave,
  }) {
    await db.query(
      `
      INSERT INTO assinatura_eventos (
        negocio_id,
        assinatura_id,
        pagamento_id,
        tipo,
        plano_anterior_id,
        plano_novo_id,
        origem,
        detalhes,
        ocorrido_em,
        chave_idempotencia
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $5,
        'sistema',
        '{}'::jsonb,
        NOW() - ($6::INT * INTERVAL '1 day'),
        $7
      )
      `,
      [
        negocioId,
        assinaturaId,
        pagamentoId,
        tipo,
        planoId,
        diasAtras,
        chave,
      ]
    );
  }

  test("mantém negócio na mesma coorte, respeita maturidade e separa reversão", async () => {
    const plano = await db.query(
      `
      SELECT id, valor
      FROM planos
      WHERE slug = 'studio'
      LIMIT 1
      `
    );
    const planoId = Number(plano.rows[0].id);

    const antes = await buscarLtvObservado();

    const negocioMaduro = await criarNegocio(
      planoId,
      "LTV Maduro"
    );
    const assinaturaInicial = await criarAssinatura({
      negocioId: negocioMaduro,
      planoId,
      valor: 49.9,
    });
    const pagamentoInicial = await criarPagamento({
      assinaturaId: assinaturaInicial,
      valor: 49.9,
      diasAtras: 95,
    });
    await criarPagamento({
      assinaturaId: assinaturaInicial,
      valor: 49.9,
      diasAtras: 65,
    });

    const assinaturaPosterior = await criarAssinatura({
      negocioId: negocioMaduro,
      planoId,
      valor: 99.9,
    });
    await criarPagamento({
      assinaturaId: assinaturaPosterior,
      valor: 99.9,
      diasAtras: 35,
    });
    const pagamentoReativacao = await criarPagamento({
      assinaturaId: assinaturaPosterior,
      valor: 99.9,
      diasAtras: 5,
      status: "PARTIALLY_REFUNDED",
    });

    await registrarEvento({
      negocioId: negocioMaduro,
      assinaturaId: assinaturaInicial,
      pagamentoId: pagamentoInicial,
      tipo: "CONVERSAO_INICIAL",
      planoId,
      diasAtras: 95,
      chave:
        `test:wave26:${negocioMaduro}:conversao`,
    });
    await registrarEvento({
      negocioId: negocioMaduro,
      assinaturaId: assinaturaInicial,
      tipo: "ACESSO_PAGO_ENCERRADO",
      planoId,
      diasAtras: 40,
      chave:
        `test:wave26:${negocioMaduro}:saida`,
    });
    await registrarEvento({
      negocioId: negocioMaduro,
      assinaturaId: assinaturaPosterior,
      pagamentoId: pagamentoReativacao,
      tipo: "REATIVACAO_PAGA",
      planoId,
      diasAtras: 5,
      chave:
        `test:wave26:${negocioMaduro}:reativacao`,
    });

    const negocioImaturo = await criarNegocio(
      planoId,
      "LTV Imaturo"
    );
    const assinaturaImatura = await criarAssinatura({
      negocioId: negocioImaturo,
      planoId,
      valor: 99.9,
    });
    const pagamentoImaturo = await criarPagamento({
      assinaturaId: assinaturaImatura,
      valor: 99.9,
      diasAtras: 10,
    });
    await registrarEvento({
      negocioId: negocioImaturo,
      assinaturaId: assinaturaImatura,
      pagamentoId: pagamentoImaturo,
      tipo: "CONVERSAO_INICIAL",
      planoId,
      diasAtras: 10,
      chave:
        `test:wave26:${negocioImaturo}:conversao`,
    });

    const negocioPreCutover = await criarNegocio(
      planoId,
      "LTV Pre Cutover"
    );
    const assinaturaPreCutover = await criarAssinatura({
      negocioId: negocioPreCutover,
      planoId,
      valor: 199.9,
    });
    const pagamentoPreCutover = await criarPagamento({
      assinaturaId: assinaturaPreCutover,
      valor: 199.9,
      diasAtras: 130,
    });
    await registrarEvento({
      negocioId: negocioPreCutover,
      assinaturaId: assinaturaPreCutover,
      pagamentoId: pagamentoPreCutover,
      tipo: "CONVERSAO_INICIAL",
      planoId,
      diasAtras: 130,
      chave:
        `test:wave26:${negocioPreCutover}:conversao`,
    });

    const depois = await buscarLtvObservado();

    expect(
      somar(depois.coortes, "negocios") -
      somar(antes.coortes, "negocios")
    ).toBe(2);
    expect(
      somar(depois.coortes, "maduros_d30") -
      somar(antes.coortes, "maduros_d30")
    ).toBe(1);
    expect(
      somar(depois.coortes, "maduros_d60") -
      somar(antes.coortes, "maduros_d60")
    ).toBe(1);
    expect(
      somar(depois.coortes, "maduros_d90") -
      somar(antes.coortes, "maduros_d90")
    ).toBe(1);
    expect(
      somar(depois.coortes, "receita_bruta_d30") -
      somar(antes.coortes, "receita_bruta_d30")
    ).toBeCloseTo(99.8, 2);
    expect(
      somar(depois.coortes, "receita_bruta_d60") -
      somar(antes.coortes, "receita_bruta_d60")
    ).toBeCloseTo(199.7, 2);
    expect(
      somar(depois.coortes, "receita_bruta_d90") -
      somar(antes.coortes, "receita_bruta_d90")
    ).toBeCloseTo(299.6, 2);
    expect(
      somar(depois.coortes, "valor_exposto_reversoes") -
      somar(antes.coortes, "valor_exposto_reversoes")
    ).toBeCloseTo(99.9, 2);
    expect(
      somar(depois.coortes, "pagamentos_em_reversao") -
      somar(antes.coortes, "pagamentos_em_reversao")
    ).toBe(1);
  });
});
