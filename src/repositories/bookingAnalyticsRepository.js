const db = require("../db/db");

function obterExecutor(executor) {
  return executor && typeof executor.query === "function"
    ? executor
    : db;
}

async function buscarContextoAgendamento(
  agendamentoId,
  executor = db
) {
  const conexao = obterExecutor(executor);

  const resultado = await conexao.query(
    `
      SELECT
        a.id AS booking_id,
        a.negocio_id AS business_id,
        a.profissional_id AS professional_id,
        a.client_id,
        a.servico_id AS service_id,
        a.status,
        a.servico_nome AS service_name_snapshot,
        a.valor_servico AS price_snapshot,
        a.duracao_minutos AS duration_snapshot,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS horario,
        COALESCE(
          NULLIF(n.fuso_horario, ''),
          'America/Sao_Paulo'
        ) AS business_timezone
      FROM agendamentos a
      INNER JOIN negocios n
        ON n.id = a.negocio_id
      WHERE a.id = $1
      LIMIT 1
    `,
    [agendamentoId]
  );

  return resultado.rows[0] || null;
}

async function registrarEvento(
  {
    eventId,
    nome,
    occurredAt,
    actorUserId = null,
    actorBusinessId = null,
    businessId,
    serviceId = null,
    bookingId,
    propriedades = {},
  },
  executor = db
) {
  const conexao = obterExecutor(executor);

  const resultado = await conexao.query(
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
        agendamento_id,
        flow_uuid,
        propriedades
      )
      VALUES (
        $1::UUID,
        NULL,
        NULL,
        $2,
        1,
        'backend',
        $3::TIMESTAMPTZ,
        $4,
        $5,
        $6,
        $7,
        $8,
        NULL,
        $9::JSONB
      )
      ON CONFLICT (event_uuid)
      DO NOTHING
      RETURNING
        id,
        event_uuid::TEXT AS event_id,
        nome,
        occurred_at,
        origem,
        actor_user_id,
        actor_business_id,
        target_business_id,
        target_service_id,
        agendamento_id,
        propriedades
    `,
    [
      eventId,
      nome,
      occurredAt,
      actorUserId,
      actorBusinessId,
      businessId,
      serviceId,
      bookingId,
      JSON.stringify(propriedades),
    ]
  );

  return resultado.rows[0] || null;
}

module.exports = {
  buscarContextoAgendamento,
  registrarEvento,
};
