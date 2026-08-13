const db = require("../db/db");

async function listarVinculos() {
  const resultado = await db.query(`
    SELECT
      v.id,
      v.campanha_id,
      v.provedor,
      v.conta_externa_id,
      v.campanha_externa_id,
      v.campanha_externa_nome,
      v.updated_at,
      c.nome AS campanha_nome,
      c.canal,
      c.utm_source,
      c.utm_campaign
    FROM marketing_campanha_vinculos v
    INNER JOIN marketing_campanhas c ON c.id = v.campanha_id
    ORDER BY v.provedor ASC, c.nome ASC, v.id ASC
  `);
  return resultado.rows;
}

async function salvarVinculo({ campanhaId, provedor, contaExternaId, campanhaExternaId, campanhaExternaNome }) {
  const resultado = await db.query(`
    INSERT INTO marketing_campanha_vinculos (
      campanha_id, provedor, conta_externa_id, campanha_externa_id, campanha_externa_nome
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (campanha_id, provedor)
    DO UPDATE SET
      conta_externa_id = EXCLUDED.conta_externa_id,
      campanha_externa_id = EXCLUDED.campanha_externa_id,
      campanha_externa_nome = EXCLUDED.campanha_externa_nome,
      updated_at = NOW()
    RETURNING *
  `, [campanhaId, provedor, contaExternaId, campanhaExternaId, campanhaExternaNome]);
  return resultado.rows[0];
}

async function buscarVinculosPorProvedor(provedor) {
  const resultado = await db.query(`
    SELECT *
    FROM marketing_campanha_vinculos
    WHERE provedor = $1
  `, [provedor]);
  return resultado.rows;
}

async function salvarGastoAutomaticoComExecutor(
  executor,
  { campanhaId, dataGasto, valorCentavos, provedor }
) {
  const resultado = await executor.query(`
    INSERT INTO marketing_campanha_gastos (
      campanha_id, data_gasto, valor_centavos, moeda, fonte, observacao
    ) VALUES ($1, $2, $3, 'BRL', $4, NULL)
    ON CONFLICT (campanha_id, data_gasto, fonte)
    DO UPDATE SET
      valor_centavos = EXCLUDED.valor_centavos,
      moeda = EXCLUDED.moeda,
      observacao = NULL,
      updated_at = NOW()
    RETURNING id
  `, [campanhaId, dataGasto, valorCentavos, provedor]);
  return resultado.rows[0];
}

async function salvarGastoAutomatico({ campanhaId, dataGasto, valorCentavos, provedor }) {
  return salvarGastoAutomaticoComExecutor(db, {
    campanhaId,
    dataGasto,
    valorCentavos,
    provedor
  });
}

function idsCampanhasValidos(campanhaIds) {
  return [
    ...new Set(
      (campanhaIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  ];
}

async function reconciliarGastosAutomaticos({
  provedor,
  dataInicio,
  dataFim,
  campanhaIds,
  gastos
}) {
  const ids = idsCampanhasValidos(campanhaIds);
  const itens = Array.isArray(gastos) ? gastos : [];

  if (ids.length === 0) {
    return {
      removidos: 0,
      salvos: 0
    };
  }

  const idsPermitidos = new Set(ids);
  for (const item of itens) {
    if (!idsPermitidos.has(Number(item?.campanhaId))) {
      throw new Error(
        "A reconciliação recebeu custo de uma campanha sem vínculo com o provedor."
      );
    }
  }

  return db.executarTransacao(async (client) => {
    const removidos = await client.query(`
      DELETE FROM marketing_campanha_gastos
      WHERE fonte = $1
        AND data_gasto BETWEEN $2::date AND $3::date
        AND campanha_id = ANY($4::bigint[])
    `, [provedor, dataInicio, dataFim, ids]);

    for (const item of itens) {
      await salvarGastoAutomaticoComExecutor(
        client,
        {
          campanhaId: Number(item.campanhaId),
          dataGasto: item.dataGasto,
          valorCentavos: item.valorCentavos,
          provedor
        }
      );
    }

    return {
      removidos: removidos.rowCount || 0,
      salvos: itens.length
    };
  });
}

async function iniciarSincronizacao({ provedor, dataInicio, dataFim, usuarioId }) {
  const resultado = await db.query(`
    INSERT INTO marketing_custo_sincronizacoes (
      provedor, status, data_inicio, data_fim, iniciado_por_usuario_id
    ) VALUES ($1, 'executando', $2, $3, $4)
    RETURNING id, created_at
  `, [provedor, dataInicio, dataFim, usuarioId || null]);
  return resultado.rows[0];
}

async function finalizarSincronizacao({ id, status, importados, naoVinculadas, erroCodigo, erroMensagem }) {
  await db.query(`
    UPDATE marketing_custo_sincronizacoes
    SET
      status = $2,
      registros_importados = $3,
      campanhas_nao_vinculadas = $4,
      erro_codigo = $5,
      erro_mensagem = $6,
      finished_at = NOW()
    WHERE id = $1
  `, [id, status, importados, naoVinculadas, erroCodigo || null, erroMensagem || null]);
}

async function listarUltimasSincronizacoes() {
  const resultado = await db.query(`
    SELECT DISTINCT ON (provedor)
      id, provedor, status, data_inicio, data_fim,
      registros_importados, campanhas_nao_vinculadas,
      erro_codigo, erro_mensagem, created_at, finished_at
    FROM marketing_custo_sincronizacoes
    ORDER BY provedor, created_at DESC, id DESC
  `);
  return resultado.rows;
}

module.exports = {
  listarVinculos,
  salvarVinculo,
  buscarVinculosPorProvedor,
  salvarGastoAutomatico,
  reconciliarGastosAutomaticos,
  iniciarSincronizacao,
  finalizarSincronizacao,
  listarUltimasSincronizacoes
};
