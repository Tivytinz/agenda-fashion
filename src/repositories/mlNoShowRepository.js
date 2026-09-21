const db = require("../db/db");

async function capturarAmostrasPendentes({ limite }) {
  const resultado = await db.query(
    `
      WITH candidatos AS (
        SELECT
          a.id AS agendamento_id,
          a.negocio_id,
          a.client_id,
          a.cliente_id,
          COALESCE(
            primeiro_reagendamento.previous_data,
            a.data
          ) AS data,
          COALESCE(
            primeiro_reagendamento.previous_horario,
            a.horario
          ) AS horario,
          a.duracao_minutos,
          a.status,
          a.status_atendimento_em,
          a.created_at,
          COALESCE(
            NULLIF(n.fuso_horario, ''),
            'America/Sao_Paulo'
          ) AS fuso_horario
        FROM agendamentos a
        INNER JOIN negocios n
          ON n.id = a.negocio_id
        LEFT JOIN LATERAL (
          SELECT
            historico.previous_data,
            historico.previous_horario
          FROM agendamento_reagendamentos historico
          WHERE historico.agendamento_id = a.id
          ORDER BY
            historico.created_at ASC,
            historico.id ASC
          LIMIT 1
        ) primeiro_reagendamento ON TRUE
        WHERE NOT EXISTS (
          SELECT 1
          FROM ml_agendamento_no_show_amostras amostra
          WHERE amostra.agendamento_id = a.id
        )
        ORDER BY
          a.created_at ASC,
          a.id ASC
        LIMIT $1
      ),
      atributos AS (
        SELECT
          candidato.*,
          COALESCE(
            cliente_historico.total,
            0
          )::INT AS cliente_agendamentos_anteriores,
          COALESCE(
            cliente_historico.faltas,
            0
          )::INT AS cliente_faltas_anteriores,
          COALESCE(
            negocio_historico.total,
            0
          )::INT AS negocio_agendamentos_anteriores,
          COALESCE(
            negocio_historico.faltas,
            0
          )::INT AS negocio_faltas_anteriores
        FROM candidatos candidato
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::INT AS total,
            COUNT(*) FILTER (
              WHERE historico.status = 'falta'
            )::INT AS faltas
          FROM agendamentos historico
          WHERE historico.client_id = candidato.client_id
            AND historico.id <> candidato.agendamento_id
            AND historico.status IN ('realizado', 'falta')
            AND historico.status_atendimento_em IS NOT NULL
            AND historico.status_atendimento_em < candidato.created_at
        ) cliente_historico ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::INT AS total,
            COUNT(*) FILTER (
              WHERE historico.status = 'falta'
            )::INT AS faltas
          FROM agendamentos historico
          WHERE historico.negocio_id = candidato.negocio_id
            AND historico.id <> candidato.agendamento_id
            AND historico.status IN ('realizado', 'falta')
            AND historico.status_atendimento_em IS NOT NULL
            AND historico.status_atendimento_em < candidato.created_at
        ) negocio_historico ON TRUE
      )
      INSERT INTO ml_agendamento_no_show_amostras (
        agendamento_id,
        negocio_id,
        feature_version,
        antecedencia_horas,
        dia_semana,
        minuto_dia,
        duracao_minutos,
        cliente_tem_conta,
        cliente_agendamentos_anteriores,
        cliente_faltas_anteriores,
        negocio_agendamentos_anteriores,
        negocio_faltas_anteriores,
        rotulo_falta,
        rotulado_em
      )
      SELECT
        atributo.agendamento_id,
        atributo.negocio_id,
        'v1',
        ROUND(
          GREATEST(
            0,
            EXTRACT(
              EPOCH FROM (
                (
                  (
                    atributo.data + atributo.horario
                  ) AT TIME ZONE atributo.fuso_horario
                )
                - atributo.created_at
              )
            ) / 3600
          )::NUMERIC,
          2
        ),
        EXTRACT(ISODOW FROM atributo.data)::SMALLINT,
        (
          EXTRACT(HOUR FROM atributo.horario)::INT * 60
          + EXTRACT(MINUTE FROM atributo.horario)::INT
        )::SMALLINT,
        atributo.duracao_minutos,
        atributo.cliente_id IS NOT NULL,
        atributo.cliente_agendamentos_anteriores,
        atributo.cliente_faltas_anteriores,
        atributo.negocio_agendamentos_anteriores,
        atributo.negocio_faltas_anteriores,
        CASE
          WHEN atributo.status = 'falta'
            AND atributo.status_atendimento_em IS NOT NULL
            THEN TRUE
          WHEN atributo.status = 'realizado'
            AND atributo.status_atendimento_em IS NOT NULL
            THEN FALSE
          ELSE NULL
        END,
        CASE
          WHEN atributo.status IN ('realizado', 'falta')
            THEN atributo.status_atendimento_em
          ELSE NULL
        END
      FROM atributos atributo
      -- Registros legados sem timestamp explícito não recebem rótulo
      -- retroativo inventado. Eles podem ser capturados, mas permanecem fora
      -- do treinamento até existir um desfecho temporal auditável.
      ON CONFLICT (agendamento_id)
      DO NOTHING
      RETURNING agendamento_id
    `,
    [limite]
  );

  return resultado.rowCount || 0;
}

async function rotularAmostrasPendentes() {
  const resultado = await db.query(`
    UPDATE ml_agendamento_no_show_amostras amostra
    SET
      rotulo_falta = agendamento.status = 'falta',
      rotulado_em = agendamento.status_atendimento_em
    FROM agendamentos agendamento
    WHERE amostra.agendamento_id = agendamento.id
      AND amostra.rotulo_falta IS NULL
      AND agendamento.status IN ('realizado', 'falta')
      AND agendamento.status_atendimento_em IS NOT NULL
  `);

  return resultado.rowCount || 0;
}

async function obterProntidao() {
  const resultado = await db.query(`
    SELECT
      COUNT(*)::INT AS total_amostras,
      COUNT(rotulo_falta)::INT AS amostras_rotuladas,
      COUNT(*) FILTER (
        WHERE rotulo_falta = TRUE
      )::INT AS faltas,
      COUNT(*) FILTER (
        WHERE rotulo_falta = FALSE
      )::INT AS realizados,
      COUNT(*) FILTER (
        WHERE amostra.rotulo_falta IS NULL
          AND agendamento.status IN ('agendado', 'confirmado')
          AND (
            (
              agendamento.data
              + agendamento.horario
              + agendamento.duracao_minutos * INTERVAL '1 minute'
            ) AT TIME ZONE COALESCE(
              NULLIF(negocio.fuso_horario, ''),
              'America/Sao_Paulo'
            )
          ) < NOW()
      )::INT AS pendentes_vencidos,
      MIN(rotulado_em) FILTER (
        WHERE rotulo_falta IS NOT NULL
      ) AS primeiro_rotulo_em,
      MAX(rotulado_em) FILTER (
        WHERE rotulo_falta IS NOT NULL
      ) AS ultimo_rotulo_em
    FROM ml_agendamento_no_show_amostras amostra
    INNER JOIN agendamentos agendamento
      ON agendamento.id = amostra.agendamento_id
    INNER JOIN negocios negocio
      ON negocio.id = amostra.negocio_id
  `);

  return resultado.rows[0] || {
    total_amostras: 0,
    amostras_rotuladas: 0,
    faltas: 0,
    realizados: 0,
    pendentes_vencidos: 0,
    primeiro_rotulo_em: null,
    ultimo_rotulo_em: null,
  };
}


const MATURIDADE_POR_NEGOCIO_CTE = `
  WITH por_negocio AS (
    SELECT
      amostra.negocio_id,
      COUNT(*)::INT AS total_amostras,
      COUNT(amostra.rotulo_falta)::INT AS amostras_rotuladas,
      COUNT(*) FILTER (
        WHERE amostra.rotulo_falta = TRUE
      )::INT AS faltas,
      COUNT(*) FILTER (
        WHERE amostra.rotulo_falta = FALSE
      )::INT AS realizados,
      COUNT(*) FILTER (
        WHERE amostra.rotulo_falta IS NULL
          AND agendamento.status IN ('agendado', 'confirmado')
          AND (
            (
              agendamento.data
              + agendamento.horario
              + agendamento.duracao_minutos * INTERVAL '1 minute'
            ) AT TIME ZONE COALESCE(
              NULLIF(negocio.fuso_horario, ''),
              'America/Sao_Paulo'
            )
          ) < NOW()
      )::INT AS pendentes_vencidos,
      MIN(amostra.rotulado_em) FILTER (
        WHERE amostra.rotulo_falta IS NOT NULL
      ) AS primeiro_rotulo_em,
      MAX(amostra.rotulado_em) FILTER (
        WHERE amostra.rotulo_falta IS NOT NULL
      ) AS ultimo_rotulo_em
    FROM ml_agendamento_no_show_amostras amostra
    INNER JOIN agendamentos agendamento
      ON agendamento.id = amostra.agendamento_id
    INNER JOIN negocios negocio
      ON negocio.id = amostra.negocio_id
    GROUP BY amostra.negocio_id
  )
`;

async function obterResumoMaturidadeNegocios() {
  const resultado = await db.query(`
    ${MATURIDADE_POR_NEGOCIO_CTE}
    SELECT
      COUNT(*)::INT AS negocios_com_amostras,
      COUNT(*) FILTER (
        WHERE amostras_rotuladas > 0
      )::INT AS negocios_com_rotulos,
      COALESCE(SUM(amostras_rotuladas), 0)::INT
        AS amostras_rotuladas,
      COALESCE(MAX(amostras_rotuladas), 0)::INT
        AS maior_volume_rotulado
    FROM por_negocio
  `);

  return resultado.rows[0] || {
    negocios_com_amostras: 0,
    negocios_com_rotulos: 0,
    amostras_rotuladas: 0,
    maior_volume_rotulado: 0,
  };
}

async function listarMaturidadeNegocios({ limite = 20 } = {}) {
  const resultado = await db.query(
    `
      ${MATURIDADE_POR_NEGOCIO_CTE}
      SELECT
        negocio_id,
        total_amostras,
        amostras_rotuladas,
        faltas,
        realizados,
        pendentes_vencidos,
        primeiro_rotulo_em,
        ultimo_rotulo_em
      FROM por_negocio
      ORDER BY
        amostras_rotuladas DESC,
        total_amostras DESC,
        negocio_id ASC
      LIMIT $1
    `,
    [limite]
  );

  return resultado.rows;
}

async function listarMaturidadeSegmentosCliente() {
  const resultado = await db.query(`
    SELECT
      amostra.cliente_tem_conta,
      COUNT(*)::INT AS total_amostras,
      COUNT(amostra.rotulo_falta)::INT AS amostras_rotuladas,
      COUNT(*) FILTER (
        WHERE amostra.rotulo_falta = TRUE
      )::INT AS faltas,
      COUNT(*) FILTER (
        WHERE amostra.rotulo_falta = FALSE
      )::INT AS realizados,
      COUNT(*) FILTER (
        WHERE amostra.rotulo_falta IS NULL
          AND agendamento.status IN ('agendado', 'confirmado')
          AND (
            (
              agendamento.data
              + agendamento.horario
              + agendamento.duracao_minutos * INTERVAL '1 minute'
            ) AT TIME ZONE COALESCE(
              NULLIF(negocio.fuso_horario, ''),
              'America/Sao_Paulo'
            )
          ) < NOW()
      )::INT AS pendentes_vencidos,
      MIN(amostra.rotulado_em) FILTER (
        WHERE amostra.rotulo_falta IS NOT NULL
      ) AS primeiro_rotulo_em,
      MAX(amostra.rotulado_em) FILTER (
        WHERE amostra.rotulo_falta IS NOT NULL
      ) AS ultimo_rotulo_em
    FROM ml_agendamento_no_show_amostras amostra
    INNER JOIN agendamentos agendamento
      ON agendamento.id = amostra.agendamento_id
    INNER JOIN negocios negocio
      ON negocio.id = amostra.negocio_id
    GROUP BY amostra.cliente_tem_conta
    ORDER BY amostra.cliente_tem_conta DESC
  `);

  return resultado.rows;
}

async function listarMaturidadeMensal({ meses = 12 } = {}) {
  const resultado = await db.query(
    `
      SELECT
        TO_CHAR(
          date_trunc(
            'month',
            agendamento.created_at
              AT TIME ZONE 'America/Sao_Paulo'
          ),
          'YYYY-MM'
        ) AS mes,
        COUNT(*)::INT AS total_amostras,
        COUNT(amostra.rotulo_falta)::INT AS amostras_rotuladas,
        COUNT(*) FILTER (
          WHERE amostra.rotulo_falta = TRUE
        )::INT AS faltas,
        COUNT(*) FILTER (
          WHERE amostra.rotulo_falta = FALSE
        )::INT AS realizados,
        COUNT(*) FILTER (
          WHERE amostra.rotulo_falta IS NULL
            AND agendamento.status IN ('agendado', 'confirmado')
            AND (
              (
                agendamento.data
                + agendamento.horario
                + agendamento.duracao_minutos * INTERVAL '1 minute'
              ) AT TIME ZONE COALESCE(
                NULLIF(negocio.fuso_horario, ''),
                'America/Sao_Paulo'
              )
            ) < NOW()
        )::INT AS pendentes_vencidos,
        MIN(amostra.rotulado_em) FILTER (
          WHERE amostra.rotulo_falta IS NOT NULL
        ) AS primeiro_rotulo_em,
        MAX(amostra.rotulado_em) FILTER (
          WHERE amostra.rotulo_falta IS NOT NULL
        ) AS ultimo_rotulo_em
      FROM ml_agendamento_no_show_amostras amostra
      INNER JOIN agendamentos agendamento
        ON agendamento.id = amostra.agendamento_id
      INNER JOIN negocios negocio
        ON negocio.id = amostra.negocio_id
      WHERE agendamento.created_at >= (
        (
          date_trunc(
            'month',
            NOW() AT TIME ZONE 'America/Sao_Paulo'
          )
          - (($1::INT - 1) * INTERVAL '1 month')
        ) AT TIME ZONE 'America/Sao_Paulo'
      )
      GROUP BY
        date_trunc(
          'month',
          agendamento.created_at
            AT TIME ZONE 'America/Sao_Paulo'
        )
      ORDER BY
        date_trunc(
          'month',
          agendamento.created_at
            AT TIME ZONE 'America/Sao_Paulo'
        ) ASC
    `,
    [meses]
  );

  return resultado.rows;
}

module.exports = {
  capturarAmostrasPendentes,
  rotularAmostrasPendentes,
  obterProntidao,
  obterResumoMaturidadeNegocios,
  listarMaturidadeNegocios,
  listarMaturidadeSegmentosCliente,
  listarMaturidadeMensal,
};
