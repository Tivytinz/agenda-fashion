const db = require(
  "../db/db"
);

async function executarTransacao(
  callback
) {
  return db.executarTransacao(
    callback
  );
}

async function listarIntegracoes() {
  const resultado =
    await db.query(
      `
      SELECT
        i.id,
        i.fonte_id,
        f.codigo AS fonte_codigo,
        f.nome AS fonte_nome,
        f.ativa AS fonte_ativa,
        f.obrigatoria_para_margem,
        i.adaptador,
        i.ativa,
        i.intervalo_minutos,
        i.ultima_sincronizacao_em,
        i.ultimo_sucesso_em,
        i.ultima_falha_em,
        i.ultimo_erro_codigo,
        i.ultimo_erro_detalhe,
        i.created_at,
        i.updated_at
      FROM contribuicao_integracoes_sync i
      INNER JOIN contribuicao_fontes f
        ON f.id = i.fonte_id
      ORDER BY
        i.ativa DESC,
        f.nome ASC,
        i.id ASC
      `
    );

  return resultado.rows;
}

async function listarExecucoesRecentes(
  limite = 50
) {
  const seguro = Math.min(
    100,
    Math.max(
      1,
      Number(limite) || 50
    )
  );

  const resultado =
    await db.query(
      `
      SELECT
        s.id,
        s.integracao_id,
        i.adaptador,
        f.codigo AS fonte_codigo,
        f.nome AS fonte_nome,
        s.status,
        s.itens_recebidos,
        s.itens_importados,
        s.itens_replay,
        s.cobertura_inicio,
        s.cobertura_ate,
        s.cobertura_status,
        s.erro_codigo,
        s.erro_detalhe,
        s.iniciado_em,
        s.finalizado_em
      FROM contribuicao_sincronizacoes s
      INNER JOIN contribuicao_integracoes_sync i
        ON i.id = s.integracao_id
      INNER JOIN contribuicao_fontes f
        ON f.id = i.fonte_id
      ORDER BY
        s.iniciado_em DESC,
        s.id DESC
      LIMIT $1
      `,
      [seguro]
    );

  return resultado.rows;
}

async function buscarFonteAtivaPorId(
  fonteId,
  executor = db
) {
  const resultado =
    await executor.query(
      `
      SELECT
        id,
        codigo,
        nome,
        categoria,
        ativa,
        obrigatoria_para_margem
      FROM contribuicao_fontes
      WHERE id = $1
        AND ativa = TRUE
      LIMIT 1
      `,
      [fonteId]
    );

  return resultado.rows[0] ||
    null;
}

async function criarIntegracao(
  {
    fonteId,
    adaptador,
    intervaloMinutos,
    ativa,
  },
  executor = db
) {
  const resultado =
    await executor.query(
      `
      INSERT INTO contribuicao_integracoes_sync (
        fonte_id,
        adaptador,
        intervalo_minutos,
        ativa
      )
      VALUES (
        $1,
        $2,
        $3,
        $4
      )
      RETURNING *
      `,
      [
        fonteId,
        adaptador,
        intervaloMinutos,
        ativa,
      ]
    );

  return resultado.rows[0];
}

async function buscarIntegracaoPorId(
  integracaoId,
  executor = db
) {
  const resultado =
    await executor.query(
      `
      SELECT
        i.*,
        f.codigo AS fonte_codigo,
        f.nome AS fonte_nome,
        f.ativa AS fonte_ativa,
        f.obrigatoria_para_margem
      FROM contribuicao_integracoes_sync i
      INNER JOIN contribuicao_fontes f
        ON f.id = i.fonte_id
      WHERE i.id = $1
      LIMIT 1
      `,
      [integracaoId]
    );

  return resultado.rows[0] ||
    null;
}

async function listarIntegracoesVencidas() {
  const resultado =
    await db.query(
      `
      SELECT
        i.*,
        f.codigo AS fonte_codigo,
        f.nome AS fonte_nome,
        f.ativa AS fonte_ativa
      FROM contribuicao_integracoes_sync i
      INNER JOIN contribuicao_fontes f
        ON f.id = i.fonte_id
      WHERE i.ativa = TRUE
        AND f.ativa = TRUE
        AND (
          i.ultima_sincronizacao_em
            IS NULL
          OR i.ultima_sincronizacao_em
            + make_interval(
                mins =>
                  i.intervalo_minutos
              )
            <= NOW()
        )
      ORDER BY
        i.ultima_sincronizacao_em
          NULLS FIRST,
        i.id ASC
      `
    );

  return resultado.rows;
}

async function executarComLockIntegracao(
  integracaoId,
  callback
) {
  if (
    typeof callback !==
    "function"
  ) {
    throw new TypeError(
      "A sincronização bloqueada precisa receber uma função."
    );
  }

  const client =
    await db.connect();
  const chave =
    `agenda-fashion:contribution-cost-sync:${integracaoId}`;
  let bloqueado = false;

  try {
    const resultado =
      await client.query(
        `
        SELECT
          pg_try_advisory_lock(
            hashtext($1)
          ) AS bloqueado
        `,
        [chave]
      );

    bloqueado =
      resultado.rows[0]
        ?.bloqueado === true;

    if (!bloqueado) {
      return {
        executado: false,
        resultado: null,
      };
    }

    return {
      executado: true,
      resultado:
        await callback(),
    };
  } finally {
    if (bloqueado) {
      try {
        await client.query(
          `
          SELECT
            pg_advisory_unlock(
              hashtext($1)
            )
          `,
          [chave]
        );
      } catch (erro) {
        client.release(
          erro
        );
        throw erro;
      }
    }

    client.release();
  }
}

async function iniciarSincronizacao(
  {
    integracaoId,
    cursorEntrada,
  }
) {
  const resultado =
    await db.query(
      `
      INSERT INTO contribuicao_sincronizacoes (
        integracao_id,
        status,
        cursor_entrada
      )
      VALUES (
        $1,
        'EXECUTANDO',
        $2::jsonb
      )
      RETURNING *
      `,
      [
        integracaoId,
        JSON.stringify(
          cursorEntrada || {}
        ),
      ]
    );

  await db.query(
    `
    UPDATE contribuicao_integracoes_sync
    SET
      ultima_sincronizacao_em =
        NOW(),
      updated_at =
        NOW()
    WHERE id = $1
    `,
    [integracaoId]
  );

  return resultado.rows[0];
}

async function finalizarSincronizacaoSucesso(
  {
    execucaoId,
    integracaoId,
    cursorSaida,
    itensRecebidos,
    itensImportados,
    itensReplay,
    coberturaInicio,
    coberturaAte,
    coberturaStatus,
  },
  executor
) {
  await executor.query(
    `
    UPDATE contribuicao_sincronizacoes
    SET
      status = 'SUCESSO',
      cursor_saida = $2::jsonb,
      itens_recebidos = $3,
      itens_importados = $4,
      itens_replay = $5,
      cobertura_inicio = $6::date,
      cobertura_ate = $7::date,
      cobertura_status = $8,
      erro_codigo = NULL,
      erro_detalhe = NULL,
      finalizado_em = NOW()
    WHERE id = $1
      AND integracao_id = $9
      AND status = 'EXECUTANDO'
    `,
    [
      execucaoId,
      JSON.stringify(
        cursorSaida || {}
      ),
      itensRecebidos,
      itensImportados,
      itensReplay,
      coberturaInicio,
      coberturaAte,
      coberturaStatus,
      integracaoId,
    ]
  );

  await executor.query(
    `
    UPDATE contribuicao_integracoes_sync
    SET
      cursor = $2::jsonb,
      ultimo_sucesso_em =
        NOW(),
      ultimo_erro_codigo =
        NULL,
      ultimo_erro_detalhe =
        NULL,
      updated_at =
        NOW()
    WHERE id = $1
    `,
    [
      integracaoId,
      JSON.stringify(
        cursorSaida || {}
      ),
    ]
  );
}

async function finalizarSincronizacaoErro(
  {
    execucaoId,
    integracaoId,
    erroCodigo,
    erroDetalhe,
  }
) {
  await db.query(
    `
    UPDATE contribuicao_sincronizacoes
    SET
      status = 'ERRO',
      erro_codigo = $2,
      erro_detalhe = $3,
      finalizado_em = NOW()
    WHERE id = $1
      AND integracao_id = $4
      AND status = 'EXECUTANDO'
    `,
    [
      execucaoId,
      erroCodigo,
      erroDetalhe,
      integracaoId,
    ]
  );

  await db.query(
    `
    UPDATE contribuicao_integracoes_sync
    SET
      ultima_falha_em =
        NOW(),
      ultimo_erro_codigo =
        $2,
      ultimo_erro_detalhe =
        $3,
      updated_at =
        NOW()
    WHERE id = $1
    `,
    [
      integracaoId,
      erroCodigo,
      erroDetalhe,
    ]
  );
}

async function buscarCustoPorChave(
  {
    fonteId,
    chaveOrigem,
  },
  executor
) {
  const resultado =
    await executor.query(
      `
      SELECT
        id,
        fonte_id,
        negocio_id,
        chave_origem,
        tipo,
        valor,
        ocorrido_em,
        custo_referenciado_id
      FROM contribuicao_custos
      WHERE fonte_id = $1
        AND chave_origem = $2
      LIMIT 1
      `,
      [
        fonteId,
        chaveOrigem,
      ]
    );

  return resultado.rows[0] ||
    null;
}

async function buscarSaldoDebito(
  {
    fonteId,
    negocioId,
    debitoId,
  },
  executor
) {
  const debito =
    await executor.query(
      `
      SELECT
        id,
        valor
      FROM contribuicao_custos
      WHERE id = $1
        AND fonte_id = $2
        AND negocio_id = $3
        AND tipo = 'DEBITO'
      FOR UPDATE
      `,
      [
        debitoId,
        fonteId,
        negocioId,
      ]
    );

  if (!debito.rows[0]) {
    return null;
  }

  const creditos =
    await executor.query(
      `
      SELECT
        COALESCE(
          SUM(valor),
          0
        )::NUMERIC(14,2)
          AS total_creditos
      FROM contribuicao_custos
      WHERE custo_referenciado_id =
        $1
        AND tipo = 'CREDITO'
      `,
      [debitoId]
    );

  return Number(
    (
      Number(
        debito.rows[0].valor
      ) -
      Number(
        creditos.rows[0]
          ?.total_creditos ||
        0
      )
    ).toFixed(2)
  );
}

module.exports = {
  executarTransacao,
  listarIntegracoes,
  listarExecucoesRecentes,
  buscarFonteAtivaPorId,
  criarIntegracao,
  buscarIntegracaoPorId,
  listarIntegracoesVencidas,
  executarComLockIntegracao,
  iniciarSincronizacao,
  finalizarSincronizacaoSucesso,
  finalizarSincronizacaoErro,
  buscarCustoPorChave,
  buscarSaldoDebito,
};
