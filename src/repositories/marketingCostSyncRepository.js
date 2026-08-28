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
      c.objetivo,
      c.ativo,
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

async function garantirCampanhaImportadaComVinculo({
  nome,
  canal,
  objetivo,
  utmSource,
  utmMedium,
  utmCampaign,
  utmContent,
  utmTerm,
  destinoPath,
  ativo,
  criadoPorUsuarioId,
  provedor,
  contaExternaId,
  campanhaExternaId,
  campanhaExternaNome
}) {
  return db.executarTransacao(async (client) => {
    const vinculoExterno = await client.query(`
      SELECT
        v.*,
        c.nome AS campanha_nome,
        c.objetivo,
        c.canal,
        c.ativo
      FROM marketing_campanha_vinculos v
      INNER JOIN marketing_campanhas c
        ON c.id = v.campanha_id
      WHERE v.provedor = $1
        AND v.conta_externa_id = $2
        AND v.campanha_externa_id = $3
      LIMIT 1
      FOR UPDATE OF v
    `, [
      provedor,
      contaExternaId,
      campanhaExternaId
    ]);

    if (vinculoExterno.rows[0]) {
      return {
        campanhaCriada: false,
        vinculoCriado: false,
        campanha: {
          id: Number(vinculoExterno.rows[0].campanha_id),
          nome: vinculoExterno.rows[0].campanha_nome,
          objetivo: vinculoExterno.rows[0].objetivo,
          canal: vinculoExterno.rows[0].canal,
          ativo: vinculoExterno.rows[0].ativo
        },
        vinculo: vinculoExterno.rows[0]
      };
    }

    let campanhaResultado = await client.query(`
      SELECT
        id,
        nome,
        canal,
        objetivo,
        ativo,
        utm_source,
        utm_medium,
        utm_campaign
      FROM marketing_campanhas
      WHERE utm_source = $1
        AND utm_medium = $2
        AND utm_campaign = $3
      LIMIT 1
      FOR UPDATE
    `, [
      utmSource,
      utmMedium,
      utmCampaign
    ]);

    let campanha = campanhaResultado.rows[0] || null;
    let campanhaCriada = false;

    if (!campanha) {
      campanhaResultado = await client.query(`
        INSERT INTO marketing_campanhas (
          nome,
          canal,
          objetivo,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          utm_term,
          destino_path,
          ativo,
          criado_por_usuario_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11
        )
        RETURNING
          id,
          nome,
          canal,
          objetivo,
          ativo,
          utm_source,
          utm_medium,
          utm_campaign
      `, [
        nome,
        canal,
        objetivo,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        destinoPath,
        ativo,
        criadoPorUsuarioId
      ]);

      campanha = campanhaResultado.rows[0];
      campanhaCriada = true;
    }

    if (
      campanha.canal !== canal ||
      (campanha.ativo === false && ativo !== false)
    ) {
      return {
        conflito: true,
        motivo:
          campanha.canal !== canal
            ? "identidade_interna_outro_canal"
            : "campanha_interna_arquivada",
        campanhaCriada: false,
        vinculoCriado: false,
        campanha,
        vinculo: null
      };
    }

    const vinculoDaCampanha = await client.query(`
      SELECT *
      FROM marketing_campanha_vinculos
      WHERE campanha_id = $1
        AND provedor = $2
      LIMIT 1
      FOR UPDATE
    `, [
      campanha.id,
      provedor
    ]);

    const existente = vinculoDaCampanha.rows[0] || null;

    if (existente) {
      const mesmoVinculo =
        existente.conta_externa_id === contaExternaId &&
        existente.campanha_externa_id === campanhaExternaId;

      return mesmoVinculo
        ? {
            campanhaCriada,
            vinculoCriado: false,
            campanha,
            vinculo: existente
          }
        : {
            conflito: true,
            motivo: "campanha_interna_ja_vinculada",
            campanhaCriada: false,
            vinculoCriado: false,
            campanha,
            vinculo: null
          };
    }

    const vinculoResultado = await client.query(`
      INSERT INTO marketing_campanha_vinculos (
        campanha_id,
        provedor,
        conta_externa_id,
        campanha_externa_id,
        campanha_externa_nome
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      campanha.id,
      provedor,
      contaExternaId,
      campanhaExternaId,
      campanhaExternaNome
    ]);

    return {
      campanhaCriada,
      vinculoCriado: true,
      campanha,
      vinculo: vinculoResultado.rows[0]
    };
  });
}

async function buscarVinculosPorProvedor(provedor) {
  const resultado = await db.query(`
    SELECT
      v.*,
      c.objetivo,
      c.ativo,
      c.canal
    FROM marketing_campanha_vinculos v
    INNER JOIN marketing_campanhas c
      ON c.id = v.campanha_id
    WHERE v.provedor = $1
  `, [provedor]);
  return resultado.rows;
}

async function executarComLockSincronizacao(
  provedor,
  callback
) {
  if (typeof callback !== "function") {
    throw new TypeError(
      "A sincronização bloqueada precisa receber uma função."
    );
  }

  const client = await db.connect();
  const chave =
    `agenda-fashion:marketing-cost-sync:${provedor}`;
  let bloqueado = false;

  try {
    const resultado = await client.query(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS bloqueado`,
      [chave]
    );

    bloqueado =
      resultado.rows[0]?.bloqueado === true;

    if (!bloqueado) {
      return {
        executado: false,
        resultado: null,
      };
    }

    return {
      executado: true,
      resultado: await callback(),
    };
  } finally {
    if (bloqueado) {
      try {
        await client.query(
          `SELECT pg_advisory_unlock(hashtext($1))`,
          [chave]
        );
      } catch (erro) {
        client.release(erro);
        throw erro;
      }
    }

    client.release();
  }
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

async function finalizarSincronizacao({
  id,
  status,
  importados,
  naoVinculadas,
  reconciliacaoCampanhasCompleta = false,
  erroCodigo,
  erroMensagem
}) {
  await db.query(`
    UPDATE marketing_custo_sincronizacoes
    SET
      status = $2,
      registros_importados = $3,
      campanhas_nao_vinculadas = $4,
      reconciliacao_campanhas_completa = $5,
      erro_codigo = $6,
      erro_mensagem = $7,
      finished_at = NOW()
    WHERE id = $1
  `, [
    id,
    status,
    importados,
    naoVinculadas,
    reconciliacaoCampanhasCompleta === true,
    erroCodigo || null,
    erroMensagem || null
  ]);
}

async function listarUltimasSincronizacoes() {
  const resultado = await db.query(`
    SELECT DISTINCT ON (provedor)
      id, provedor, status, data_inicio, data_fim,
      registros_importados, campanhas_nao_vinculadas,
      reconciliacao_campanhas_completa,
      erro_codigo, erro_mensagem, created_at, finished_at
    FROM marketing_custo_sincronizacoes
    ORDER BY provedor, created_at DESC, id DESC
  `);
  return resultado.rows;
}

module.exports = {
  listarVinculos,
  salvarVinculo,
  garantirCampanhaImportadaComVinculo,
  buscarVinculosPorProvedor,
  executarComLockSincronizacao,
  salvarGastoAutomatico,
  reconciliarGastosAutomaticos,
  iniciarSincronizacao,
  finalizarSincronizacao,
  listarUltimasSincronizacoes
};
