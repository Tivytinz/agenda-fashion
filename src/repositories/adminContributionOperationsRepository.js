const db = require("../db/db");

async function listarPainel() {
  const [
    fontes,
    custos,
    operacoes,
    marco,
  ] = await Promise.all([
    db.query(
      `
      SELECT
        f.id,
        f.codigo,
        f.nome,
        f.categoria,
        f.ativa,
        f.obrigatoria_para_margem,
        f.created_at,
        f.updated_at,
        c.inicio_cobertura,
        c.coberto_ate,
        c.status AS cobertura_status,
        c.sincronizado_em,
        COALESCE(
          COUNT(cc.id),
          0
        )::INT AS lancamentos,
        COALESCE(
          SUM(
            CASE
              WHEN cc.tipo = 'DEBITO'
                THEN cc.valor
              WHEN cc.tipo = 'CREDITO'
                THEN -cc.valor
              ELSE 0
            END
          ),
          0
        )::NUMERIC(14,2)
          AS custo_liquido_observado
      FROM contribuicao_fontes f
      LEFT JOIN contribuicao_cobertura c
        ON c.fonte_id = f.id
      LEFT JOIN contribuicao_custos cc
        ON cc.fonte_id = f.id
      GROUP BY
        f.id,
        c.fonte_id,
        c.inicio_cobertura,
        c.coberto_ate,
        c.status,
        c.sincronizado_em
      ORDER BY
        f.ativa DESC,
        f.obrigatoria_para_margem DESC,
        f.nome ASC,
        f.id ASC
      `
    ),
    db.query(
      `
      SELECT
        cc.id,
        cc.fonte_id,
        f.codigo AS fonte_codigo,
        f.nome AS fonte_nome,
        cc.negocio_id,
        n.nome AS negocio_nome,
        cc.chave_origem,
        cc.tipo,
        cc.valor,
        cc.ocorrido_em,
        cc.custo_referenciado_id,
        cc.detalhes,
        cc.created_at
      FROM contribuicao_custos cc
      INNER JOIN contribuicao_fontes f
        ON f.id = cc.fonte_id
      INNER JOIN negocios n
        ON n.id = cc.negocio_id
      ORDER BY
        cc.ocorrido_em DESC,
        cc.id DESC
      LIMIT 100
      `
    ),
    db.query(
      `
      SELECT
        o.id,
        o.usuario_id,
        o.fonte_id,
        f.codigo AS fonte_codigo,
        o.negocio_id,
        o.custo_id,
        o.acao,
        o.motivo,
        o.detalhes,
        o.created_at
      FROM contribuicao_operacoes_admin o
      LEFT JOIN contribuicao_fontes f
        ON f.id = o.fonte_id
      ORDER BY
        o.created_at DESC,
        o.id DESC
      LIMIT 100
      `
    ),
    db.query(
      `
      SELECT ocorrido_em
      FROM financeiro_marcos
      WHERE chave =
        'fontes_contribuicao_v1_inicio'
      LIMIT 1
      `
    ),
  ]);

  return {
    inicio_cobertura:
      marco.rows[0]?.ocorrido_em ||
      null,
    fontes: fontes.rows,
    custos: custos.rows,
    operacoes: operacoes.rows,
  };
}

async function criarFonte(
  {
    codigo,
    nome,
    categoria,
    obrigatoriaParaMargem,
  },
  executor = db
) {
  const resultado =
    await executor.query(
      `
      INSERT INTO contribuicao_fontes (
        codigo,
        nome,
        categoria,
        ativa,
        obrigatoria_para_margem
      )
      VALUES (
        $1,
        $2,
        $3,
        TRUE,
        $4
      )
      RETURNING
        id,
        codigo,
        nome,
        categoria,
        ativa,
        obrigatoria_para_margem,
        created_at,
        updated_at
      `,
      [
        codigo,
        nome,
        categoria,
        obrigatoriaParaMargem,
      ]
    );

  return resultado.rows[0];
}

async function registrarOperacao(
  {
    usuarioId,
    fonteId = null,
    negocioId = null,
    custoId = null,
    acao,
    motivo,
    detalhes = {},
  },
  executor = db
) {
  const resultado =
    await executor.query(
      `
      INSERT INTO contribuicao_operacoes_admin (
        usuario_id,
        fonte_id,
        negocio_id,
        custo_id,
        acao,
        motivo,
        detalhes
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::jsonb
      )
      RETURNING
        id,
        usuario_id,
        fonte_id,
        negocio_id,
        custo_id,
        acao,
        motivo,
        detalhes,
        created_at
      `,
      [
        usuarioId,
        fonteId,
        negocioId,
        custoId,
        acao,
        motivo,
        JSON.stringify(
          detalhes || {}
        ),
      ]
    );

  return resultado.rows[0];
}

module.exports = {
  listarPainel,
  criarFonte,
  registrarOperacao,
};
