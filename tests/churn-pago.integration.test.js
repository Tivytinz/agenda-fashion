const crypto = require("crypto");
const db = require("../src/db/db");
const {
  buscarChurnPago,
} = require(
  "../src/repositories/adminAnalyticsV2Repository"
);
const {
  reconciliarInadimplenciaTerminal,
} = require(
  "../src/services/assinaturaInadimplenciaService"
);

function suffix() {
  return crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 12);
}

describe("Wave 24 - episódios pagos e churn", () => {
  const negocios = [];

  afterEach(async () => {
    for (const negocioId of negocios.splice(0)) {
      await db.query(
        "DELETE FROM assinatura_eventos WHERE negocio_id = $1",
        [negocioId]
      );
      await db.query(
        "DELETE FROM pagamentos WHERE assinatura_id IN (SELECT id FROM assinaturas WHERE negocio_id = $1)",
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

  afterAll(() => db.end());

  async function criarNegocio(planoId, nomePrefixo) {
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
        `${nomePrefixo} ${id}`,
        `wave-24-${id}`,
        planoId,
      ]
    );
    const negocioId = Number(resultado.rows[0].id);
    negocios.push(negocioId);
    return negocioId;
  }

  test("gross logo churn usa a base inicial e mantém reativação separada", async () => {
    const marco = await db.query(
      `
      SELECT ocorrido_em
      FROM financeiro_marcos
      WHERE chave = 'churn_v1_inicio'
      `
    );
    expect(marco.rows).toHaveLength(1);

    const plano = await db.query(
      `
      SELECT id
      FROM planos
      WHERE slug = 'autonoma'
      LIMIT 1
      `
    );
    const negocioId = await criarNegocio(
      plano.rows[0].id,
      "Churn V1"
    );

    const antes = await buscarChurnPago("all");

    await db.query(
      `
      INSERT INTO assinatura_eventos (
        negocio_id,
        tipo,
        motivo,
        plano_novo_id,
        origem,
        ocorrido_em,
        chave_idempotencia
      )
      VALUES (
        $1,
        'EPISODIO_PAGO_BASELINE',
        'WAVE24_CUTOVER',
        $2,
        'sistema',
        $3,
        $4
      )
      `,
      [
        negocioId,
        plano.rows[0].id,
        marco.rows[0].ocorrido_em,
        `test:wave24:${negocioId}:baseline`,
      ]
    );

    await db.query(
      `
      INSERT INTO assinatura_eventos (
        negocio_id,
        tipo,
        motivo,
        plano_anterior_id,
        origem,
        ocorrido_em,
        chave_idempotencia
      )
      VALUES (
        $1,
        'ACESSO_PAGO_ENCERRADO',
        'CANCELAMENTO_VOLUNTARIO',
        $2,
        'sistema',
        clock_timestamp(),
        $3
      )
      `,
      [
        negocioId,
        plano.rows[0].id,
        `test:wave24:${negocioId}:saida`,
      ]
    );

    const aposSaida = await buscarChurnPago("all");
    expect(
      Number(aposSaida.base_paga_inicio) -
      Number(antes.base_paga_inicio)
    ).toBe(1);
    expect(
      Number(aposSaida.saidas_terminais_base_inicial) -
      Number(antes.saidas_terminais_base_inicial)
    ).toBe(1);
    expect(
      Number(aposSaida.saidas_cancelamento_voluntario) -
      Number(antes.saidas_cancelamento_voluntario)
    ).toBe(1);

    await db.query(
      `
      INSERT INTO assinatura_eventos (
        negocio_id,
        tipo,
        motivo,
        plano_anterior_id,
        plano_novo_id,
        origem,
        ocorrido_em,
        chave_idempotencia
      )
      VALUES (
        $1,
        'REATIVACAO_PAGA',
        'RETORNO_APOS_SAIDA_PAGA',
        $2,
        $2,
        'webhook',
        clock_timestamp(),
        $3
      )
      `,
      [
        negocioId,
        plano.rows[0].id,
        `test:wave24:${negocioId}:reativacao`,
      ]
    );

    const aposReativacao =
      await buscarChurnPago("all");

    expect(
      Number(aposReativacao.saidas_terminais_base_inicial) -
      Number(antes.saidas_terminais_base_inicial)
    ).toBe(1);
    expect(
      Number(aposReativacao.negocios_reativados) -
      Number(antes.negocios_reativados)
    ).toBe(1);
    expect(
      Number(aposReativacao.base_paga_fim) -
      Number(antes.base_paga_fim)
    ).toBe(1);
  });

  test("inadimplência madura gera uma única saída terminal", async () => {
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

    const negocioId = await criarNegocio(
      gratis.id,
      "Inadimplência V1"
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
        'OVERDUE',
        'pix',
        'MONTHLY',
        $3,
        FALSE
      )
      RETURNING id
      `,
      [negocioId, pago.id, pago.valor]
    );

    const pagamento = await db.query(
      `
      INSERT INTO pagamentos (
        assinatura_id,
        asaas_payment_id,
        valor,
        forma_pagamento,
        status,
        data_vencimento
      )
      VALUES (
        $1,
        $2,
        $3,
        'pix',
        'OVERDUE',
        CURRENT_DATE - 20
      )
      RETURNING id
      `,
      [
        assinatura.rows[0].id,
        `pay_wave24_${suffix()}`,
        pago.valor,
      ]
    );

    await db.query(
      `
      INSERT INTO assinatura_eventos (
        negocio_id,
        assinatura_id,
        pagamento_id,
        tipo,
        motivo,
        plano_novo_id,
        origem,
        chave_idempotencia
      )
      VALUES
        (
          $1,
          $2,
          $3,
          'CONVERSAO_INICIAL',
          NULL,
          $4,
          'webhook',
          $5
        ),
        (
          $1,
          $2,
          $3,
          'PAGAMENTO_ATRASADO',
          'INADIMPLENCIA',
          $6,
          'webhook',
          $7
        )
      `,
      [
        negocioId,
        assinatura.rows[0].id,
        pagamento.rows[0].id,
        pago.id,
        `test:wave24:${negocioId}:inicio`,
        gratis.id,
        `test:wave24:${negocioId}:atraso`,
      ]
    );

    const primeiro =
      await reconciliarInadimplenciaTerminal({
        pagamentoId: pagamento.rows[0].id,
        janelaDias: 14,
      });

    expect(primeiro).toMatchObject({
      negocio_id: negocioId,
      tipo: "ACESSO_PAGO_ENCERRADO",
      motivo: "INADIMPLENCIA_NAO_RECUPERADA",
    });
    expect(primeiro.detalhes).toMatchObject({
      regra: "inadimplencia_v1",
      janela_recuperacao_dias: 14,
    });

    const repetido =
      await reconciliarInadimplenciaTerminal({
        pagamentoId: pagamento.rows[0].id,
        janelaDias: 14,
      });
    expect(repetido).toBeNull();

    const contagem = await db.query(
      `
      SELECT COUNT(*)::INT AS total
      FROM assinatura_eventos
      WHERE pagamento_id = $1
        AND tipo = 'ACESSO_PAGO_ENCERRADO'
      `,
      [pagamento.rows[0].id]
    );
    expect(contagem.rows[0].total).toBe(1);
  });
});
