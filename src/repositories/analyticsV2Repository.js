const db = require("../db/db");

function executorSeguro(executor) {
  return executor && typeof executor.query === "function"
    ? executor
    : db;
}

async function upsertVisitante({ visitorUuid, occurredAt }, executor = db) {
  const conexao = executorSeguro(executor);
  const result = await conexao.query(
    `
    INSERT INTO analytics_visitantes (
      visitor_uuid,
      primeiro_visto_em,
      ultimo_visto_em
    )
    VALUES ($1::UUID, $2::TIMESTAMPTZ, $2::TIMESTAMPTZ)
    ON CONFLICT (visitor_uuid)
    DO UPDATE SET
      ultimo_visto_em = GREATEST(
        analytics_visitantes.ultimo_visto_em,
        EXCLUDED.ultimo_visto_em
      )
    RETURNING id, visitor_uuid
    `,
    [visitorUuid, occurredAt]
  );

  return result.rows[0] || null;
}

async function upsertSessao({
  sessionUuid,
  visitanteId,
  usuarioId,
  occurredAt,
  deviceType,
  browserFamily,
  browserMajor,
  osFamily,
}, executor = db) {
  const conexao = executorSeguro(executor);
  const result = await conexao.query(
    `
    INSERT INTO analytics_sessoes (
      session_uuid,
      visitante_id,
      usuario_id,
      identificado_em,
      iniciada_em,
      ultima_atividade_em,
      device_type,
      browser_family,
      browser_major,
      os_family
    )
    VALUES (
      $1::UUID,
      $2,
      $3,
      CASE WHEN $3::BIGINT IS NULL THEN NULL ELSE $4::TIMESTAMPTZ END,
      $4::TIMESTAMPTZ,
      $4::TIMESTAMPTZ,
      $5,
      $6,
      $7,
      $8
    )
    ON CONFLICT (session_uuid)
    DO UPDATE SET
      usuario_id = COALESCE(analytics_sessoes.usuario_id, EXCLUDED.usuario_id),
      identificado_em = CASE
        WHEN analytics_sessoes.usuario_id IS NULL
          AND EXCLUDED.usuario_id IS NOT NULL
          THEN COALESCE(analytics_sessoes.identificado_em, EXCLUDED.identificado_em)
        ELSE analytics_sessoes.identificado_em
      END,
      ultima_atividade_em = GREATEST(
        analytics_sessoes.ultima_atividade_em,
        EXCLUDED.ultima_atividade_em
      ),
      device_type = COALESCE(analytics_sessoes.device_type, EXCLUDED.device_type),
      browser_family = COALESCE(analytics_sessoes.browser_family, EXCLUDED.browser_family),
      browser_major = COALESCE(analytics_sessoes.browser_major, EXCLUDED.browser_major),
      os_family = COALESCE(analytics_sessoes.os_family, EXCLUDED.os_family)
    WHERE analytics_sessoes.visitante_id = EXCLUDED.visitante_id
      AND (
        analytics_sessoes.usuario_id IS NULL
        OR EXCLUDED.usuario_id IS NULL
        OR analytics_sessoes.usuario_id = EXCLUDED.usuario_id
      )
    RETURNING id, session_uuid, usuario_id, iniciada_em
    `,
    [
      sessionUuid,
      visitanteId,
      usuarioId || null,
      occurredAt,
      deviceType || null,
      browserFamily || null,
      browserMajor || null,
      osFamily || null,
    ]
  );

  return result.rows[0] || null;
}

async function vincularIdentidade({
  visitanteId,
  usuarioId,
  vinculoTipo,
  occurredAt,
}, executor = db) {
  if (!usuarioId) return null;
  const conexao = executorSeguro(executor);
  const result = await conexao.query(
    `
    INSERT INTO analytics_identidade_vinculos (
      visitante_id,
      usuario_id,
      vinculo_tipo,
      primeiro_vinculo_em,
      ultima_confirmacao_em
    )
    VALUES ($1, $2, $3, $4::TIMESTAMPTZ, $4::TIMESTAMPTZ)
    ON CONFLICT (visitante_id, usuario_id)
    DO UPDATE SET
      ultima_confirmacao_em = GREATEST(
        analytics_identidade_vinculos.ultima_confirmacao_em,
        EXCLUDED.ultima_confirmacao_em
      ),
      vinculo_tipo = CASE
        WHEN analytics_identidade_vinculos.vinculo_tipo = 'cadastro'
          THEN analytics_identidade_vinculos.vinculo_tipo
        ELSE EXCLUDED.vinculo_tipo
      END
    RETURNING id
    `,
    [visitanteId, usuarioId, vinculoTipo, occurredAt]
  );

  return result.rows[0] || null;
}

async function resolverNegocioDoAtor(usuarioId, executor = db) {
  if (!usuarioId) return null;
  const conexao = executorSeguro(executor);
  const result = await conexao.query(
    `
    SELECT un.negocio_id
    FROM usuarios_negocios un
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    WHERE un.usuario_id = $1
      AND un.ativo = TRUE
      AND n.ativo = TRUE
      AND un.papel IN ('dono', 'profissional')
    ORDER BY
      CASE un.papel WHEN 'dono' THEN 1 ELSE 2 END,
      un.created_at ASC,
      un.id ASC
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0]?.negocio_id || null;
}

async function registrarVisualizacao({
  viewUuid,
  sessaoId,
  sequencia,
  pageKey,
  routeTemplate,
  targetBusinessId,
  targetServiceId,
  occurredAt,
}, executor = db) {
  const conexao = executorSeguro(executor);
  const result = await conexao.query(
    `
    INSERT INTO analytics_visualizacoes_tela (
      view_uuid,
      sessao_id,
      sequencia,
      page_key,
      route_template,
      target_business_id,
      target_service_id,
      entrou_em,
      ultima_atividade_em
    )
    VALUES (
      $1::UUID,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8::TIMESTAMPTZ,
      $8::TIMESTAMPTZ
    )
    ON CONFLICT (view_uuid)
    DO NOTHING
    RETURNING id
    `,
    [
      viewUuid,
      sessaoId,
      sequencia,
      pageKey,
      routeTemplate,
      targetBusinessId || null,
      targetServiceId || null,
      occurredAt,
    ]
  );

  return result.rows[0] || null;
}

async function registrarEngajamento({
  viewUuid,
  sessaoId,
  engagedMs,
  occurredAt,
  motivoSaida,
  encerrar,
}, executor = db) {
  const conexao = executorSeguro(executor);
  const result = await conexao.query(
    `
    UPDATE analytics_visualizacoes_tela
    SET
      tempo_engajado_ms = GREATEST(tempo_engajado_ms, $3::BIGINT),
      ultima_atividade_em = GREATEST(ultima_atividade_em, $4::TIMESTAMPTZ),
      saiu_em = CASE
        WHEN $6::BOOLEAN THEN COALESCE(saiu_em, $4::TIMESTAMPTZ)
        ELSE saiu_em
      END,
      motivo_saida = CASE
        WHEN $6::BOOLEAN THEN COALESCE($5, motivo_saida)
        ELSE motivo_saida
      END
    WHERE view_uuid = $1::UUID
      AND sessao_id = $2
    RETURNING id
    `,
    [viewUuid, sessaoId, engagedMs, occurredAt, motivoSaida || null, encerrar === true]
  );

  return result.rows[0] || null;
}

async function registrarEvento({
  eventUuid,
  sessaoId,
  visualizacaoId,
  nome,
  schemaVersion,
  origem,
  occurredAt,
  actorUserId,
  actorBusinessId,
  targetBusinessId,
  targetServiceId,
  flowUuid,
  propriedades,
}, executor = db) {
  const conexao = executorSeguro(executor);
  const result = await conexao.query(
    `
    INSERT INTO analytics_eventos (
      event_uuid,
      sessao_id,
      visualizacao_id,
      nome,
      schema_version,
      origem,
      occurred_at,
      actor_user_id,
      actor_business_id,
      target_business_id,
      target_service_id,
      flow_uuid,
      propriedades
    )
    VALUES (
      $1::UUID,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7::TIMESTAMPTZ,
      $8,
      $9,
      $10,
      $11,
      $12::UUID,
      $13::JSONB
    )
    ON CONFLICT (event_uuid)
    DO NOTHING
    RETURNING id
    `,
    [
      eventUuid,
      sessaoId || null,
      visualizacaoId || null,
      nome,
      schemaVersion,
      origem,
      occurredAt,
      actorUserId || null,
      actorBusinessId || null,
      targetBusinessId || null,
      targetServiceId || null,
      flowUuid || null,
      JSON.stringify(propriedades || {}),
    ]
  );

  return result.rows[0] || null;
}

async function buscarVisualizacaoPorUuid(viewUuid, sessaoId, executor = db) {
  if (!viewUuid) return null;
  const conexao = executorSeguro(executor);
  const result = await conexao.query(
    `
    SELECT id
    FROM analytics_visualizacoes_tela
    WHERE view_uuid = $1::UUID
      AND sessao_id = $2
    LIMIT 1
    `,
    [viewUuid, sessaoId]
  );

  return result.rows[0] || null;
}

async function recalcularSessao(sessaoId, occurredAt, executor = db) {
  const conexao = executorSeguro(executor);
  const result = await conexao.query(
    `
    UPDATE analytics_sessoes s
    SET
      ultima_atividade_em = GREATEST(s.ultima_atividade_em, $2::TIMESTAMPTZ),
      visualizacoes = (
        SELECT COUNT(*)::INT
        FROM analytics_visualizacoes_tela v
        WHERE v.sessao_id = s.id
      ),
      eventos = (
        SELECT COUNT(*)::INT
        FROM analytics_eventos e
        WHERE e.sessao_id = s.id
      ),
      tempo_engajado_ms = COALESCE((
        SELECT SUM(v.tempo_engajado_ms)::BIGINT
        FROM analytics_visualizacoes_tela v
        WHERE v.sessao_id = s.id
      ), 0),
      tela_entrada = COALESCE(
        s.tela_entrada,
        (
          SELECT v.page_key
          FROM analytics_visualizacoes_tela v
          WHERE v.sessao_id = s.id
          ORDER BY v.sequencia ASC
          LIMIT 1
        )
      ),
      tela_saida = (
        SELECT v.page_key
        FROM analytics_visualizacoes_tela v
        WHERE v.sessao_id = s.id
        ORDER BY v.sequencia DESC
        LIMIT 1
      )
    WHERE s.id = $1
    RETURNING
      id,
      visualizacoes,
      eventos,
      tempo_engajado_ms,
      tela_entrada,
      tela_saida
    `,
    [sessaoId, occurredAt]
  );

  return result.rows[0] || null;
}

module.exports = {
  upsertVisitante,
  upsertSessao,
  vincularIdentidade,
  resolverNegocioDoAtor,
  registrarVisualizacao,
  registrarEngajamento,
  registrarEvento,
  buscarVisualizacaoPorUuid,
  recalcularSessao,
  executarTransacao: db.executarTransacao,
};
