const crypto = require("crypto");
const db = require("../src/db/db");
const {
  buscarMrr,
} = require(
  "../src/repositories/adminAnalyticsV2Repository"
);

function suffix() {
  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe("Wave 25 - MRR e NRR canônicos", () => {
  const negocios = [];

  afterEach(async () => {
    for (const negocioId of negocios.splice(0)) {
      await db.query(
        "DELETE FROM assinatura_eventos WHERE negocio_id = $1",
        [negocioId]
      );
      await db.query(
        "DELETE FROM negocios WHERE id = $1",
        [negocioId]
      );
    }
  });

  afterAll(() => db.end());

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
        `wave-25-${id}`,
        planoId,
      ]
    );

    const negocioId = Number(
      resultado.rows[0].id
    );
    negocios.push(negocioId);
    return negocioId;
  }

  async function registrarEvento({
    negocioId,
    tipo,
    anterior,
    novo,
    chave,
    planoId,
  }) {
    await db.query(
      `
      INSERT INTO assinatura_eventos (
        negocio_id,
        tipo,
        motivo,
        plano_anterior_id,
        plano_novo_id,
        origem,
        detalhes,
        valor_mensal_anterior,
        valor_mensal_novo,
        periodicidade_snapshot,
        ocorrido_em,
        chave_idempotencia
      )
      VALUES (
        $1,
        $2,
        'TESTE_WAVE25',
        $3,
        $3,
        'sistema',
        '{}'::jsonb,
        $4,
        $5,
        'MONTHLY',
        clock_timestamp(),
        $6
      )
      `,
      [
        negocioId,
        tipo,
        planoId,
        anterior,
        novo,
        chave,
      ]
    );
  }

  test("bridge separa new expansion churn e reativação sem apagar GRR", async () => {
    const marco = await db.query(
      `
      SELECT ocorrido_em
      FROM financeiro_marcos
      WHERE chave = 'mrr_v1_inicio'
      `
    );
    expect(marco.rows).toHaveLength(1);

    const plano = await db.query(
      `
      SELECT id
      FROM planos
      WHERE slug = 'studio'
      LIMIT 1
      `
    );
    const planoId = Number(plano.rows[0].id);

    const antes = await buscarMrr("all");

    const negocioA = await criarNegocio(
      planoId,
      "MRR Expansion"
    );
    const negocioB = await criarNegocio(
      planoId,
      "MRR Churn"
    );
    const negocioC = await criarNegocio(
      planoId,
      "MRR New"
    );

    for (const negocioId of [negocioA, negocioB]) {
      await db.query(
        `
        INSERT INTO assinatura_eventos (
          negocio_id,
          tipo,
          motivo,
          plano_anterior_id,
          plano_novo_id,
          origem,
          detalhes,
          valor_mensal_anterior,
          valor_mensal_novo,
          periodicidade_snapshot,
          ocorrido_em,
          chave_idempotencia
        )
        VALUES (
          $1,
          'MRR_BASELINE',
          'WAVE25_CUTOVER',
          $2,
          $2,
          'sistema',
          '{"regra":"mrr_v1"}'::jsonb,
          100,
          100,
          'MONTHLY',
          (
            SELECT ocorrido_em
            FROM financeiro_marcos
            WHERE chave = 'mrr_v1_inicio'
          ),
          $3
        )
        `,
        [
          negocioId,
          planoId,
          `test:wave25:${negocioId}:baseline`,
        ]
      );
    }

    await registrarEvento({
      negocioId: negocioA,
      tipo: "PLANO_ALTERADO",
      anterior: 100,
      novo: 150,
      chave: `test:wave25:${negocioA}:expansion`,
      planoId,
    });

    await registrarEvento({
      negocioId: negocioB,
      tipo: "ACESSO_PAGO_ENCERRADO",
      anterior: 100,
      novo: 0,
      chave: `test:wave25:${negocioB}:churn`,
      planoId,
    });

    await registrarEvento({
      negocioId: negocioC,
      tipo: "CONVERSAO_INICIAL",
      anterior: 0,
      novo: 50,
      chave: `test:wave25:${negocioC}:new`,
      planoId,
    });

    const aposSaida = await buscarMrr("all");

    expect(
      Number(aposSaida.mrr_inicial) -
      Number(antes.mrr_inicial)
    ).toBe(200);
    expect(
      Number(aposSaida.expansion_mrr) -
      Number(antes.expansion_mrr)
    ).toBe(50);
    expect(
      Number(aposSaida.churned_mrr) -
      Number(antes.churned_mrr)
    ).toBe(100);
    expect(
      Number(aposSaida.new_mrr) -
      Number(antes.new_mrr)
    ).toBe(50);
    expect(
      Number(aposSaida.mrr_final_coorte_inicial) -
      Number(antes.mrr_final_coorte_inicial)
    ).toBe(150);
    expect(
      Number(aposSaida.mrr_retido_bruto) -
      Number(antes.mrr_retido_bruto)
    ).toBe(100);
    expect(
      Number(aposSaida.mrr_final_total) -
      Number(antes.mrr_final_total)
    ).toBe(200);

    await registrarEvento({
      negocioId: negocioB,
      tipo: "REATIVACAO_PAGA",
      anterior: 0,
      novo: 100,
      chave: `test:wave25:${negocioB}:reativacao`,
      planoId,
    });

    const aposReativacao = await buscarMrr("all");

    expect(
      Number(aposReativacao.reactivation_mrr) -
      Number(antes.reactivation_mrr)
    ).toBe(100);
    expect(
      Number(aposReativacao.mrr_final_coorte_inicial) -
      Number(antes.mrr_final_coorte_inicial)
    ).toBe(250);
    expect(
      Number(aposReativacao.mrr_retido_bruto) -
      Number(antes.mrr_retido_bruto)
    ).toBe(100);
    expect(
      Number(aposReativacao.mrr_final_total) -
      Number(antes.mrr_final_total)
    ).toBe(300);
  });

  test("atraso recuperável mantém o MRR e o expõe como risco", async () => {
    const plano = await db.query(
      `
      SELECT id
      FROM planos
      WHERE slug = 'autonoma'
      LIMIT 1
      `
    );
    const planoId = Number(plano.rows[0].id);
    const negocioId = await criarNegocio(
      planoId,
      "MRR Risco"
    );
    const antes = await buscarMrr("all");

    await db.query(
      `
      INSERT INTO assinatura_eventos (
        negocio_id,
        tipo,
        motivo,
        plano_anterior_id,
        plano_novo_id,
        origem,
        valor_mensal_anterior,
        valor_mensal_novo,
        periodicidade_snapshot,
        ocorrido_em,
        chave_idempotencia
      )
      VALUES (
        $1,
        'MRR_BASELINE',
        'WAVE25_CUTOVER',
        $2,
        $2,
        'sistema',
        49.90,
        49.90,
        'MONTHLY',
        (
          SELECT ocorrido_em
          FROM financeiro_marcos
          WHERE chave = 'mrr_v1_inicio'
        ),
        $3
      )
      `,
      [
        negocioId,
        planoId,
        `test:wave25:${negocioId}:baseline`,
      ]
    );

    await registrarEvento({
      negocioId,
      tipo: "PAGAMENTO_ATRASADO",
      anterior: 49.9,
      novo: 49.9,
      chave: `test:wave25:${negocioId}:overdue`,
      planoId,
    });

    const atrasado = await buscarMrr("all");

    expect(
      Number(atrasado.mrr_final_total) -
      Number(antes.mrr_final_total)
    ).toBe(49.9);
    expect(
      Number(atrasado.mrr_em_risco) -
      Number(antes.mrr_em_risco)
    ).toBe(49.9);
    expect(
      Number(atrasado.negocios_mrr_em_risco) -
      Number(antes.negocios_mrr_em_risco)
    ).toBe(1);

    await registrarEvento({
      negocioId,
      tipo: "PAGAMENTO_RECUPERADO",
      anterior: 49.9,
      novo: 49.9,
      chave: `test:wave25:${negocioId}:recovery`,
      planoId,
    });

    const recuperado = await buscarMrr("all");

    expect(
      Number(recuperado.mrr_final_total) -
      Number(antes.mrr_final_total)
    ).toBe(49.9);
    expect(
      Number(recuperado.mrr_em_risco) -
      Number(antes.mrr_em_risco)
    ).toBe(0);
  });
});
