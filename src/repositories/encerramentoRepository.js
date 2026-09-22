const db = require("../db/db");

const STATUS_RESERVA_ATIVA = [
  "agendado",
  "confirmado",
];

async function bloquearUsuario(
  usuarioId,
  executor = db
) {
  const result = await executor.query(
    `
      SELECT
        id,
        ativo,
        desativado_em,
        encerrado_definitivo_em
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarNegocioOperacionalDoDono(
  usuarioId,
  executor = db,
  { bloquear = false } = {}
) {
  const result = await executor.query(
    `
      SELECT
        n.id,
        n.nome,
        n.slug,
        n.plano_id,
        n.ativo,
        n.publicado,
        n.arquivado_em
      FROM usuarios_negocios un
      INNER JOIN negocios n
        ON n.id = un.negocio_id
      WHERE un.usuario_id = $1
        AND un.papel = 'dono'
        AND un.ativo = TRUE
        AND n.ativo = TRUE
        AND n.arquivado_em IS NULL
      ORDER BY n.id ASC
      LIMIT 1
      ${bloquear ? "FOR UPDATE OF n, un" : ""}
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarPendenciasNegocio(
  negocioId,
  executor = db
) {
  const result = await executor.query(
    `
      SELECT
        (
          SELECT COUNT(*)::int
          FROM agendamentos a
          WHERE a.negocio_id = $1
            AND a.status = ANY($2::text[])
        ) AS agendamentos_confirmados,

        EXISTS (
          SELECT 1
          FROM assinaturas a
          INNER JOIN planos p
            ON p.id = a.plano_id
          WHERE a.negocio_id = $1
            AND a.ativo = TRUE
            AND p.slug <> 'inicial'
        ) AS acesso_pago_ativo,

        EXISTS (
          SELECT 1
          FROM assinaturas a
          WHERE a.negocio_id = $1
            AND a.ativo = FALSE
            AND UPPER(a.status) IN (
              'PENDING',
              'PENDING_PAYMENT'
            )
        ) AS checkout_pendente,

        EXISTS (
          SELECT 1
          FROM pagamentos pg
          INNER JOIN assinaturas a
            ON a.id = pg.assinatura_id
          WHERE a.negocio_id = $1
            AND UPPER(pg.status) IN (
              'PENDING',
              'CREATED',
              'AWAITING_PAYMENT',
              'CHARGEBACK_REQUESTED',
              'CHARGEBACK_DISPUTE',
              'AWAITING_CHARGEBACK_REVERSAL'
            )
        ) AS operacao_financeira_pendente,

        EXISTS (
          SELECT 1
          FROM checkout_tentativas ct
          WHERE ct.negocio_id = $1
            AND ct.status = 'PROCESSING'
        ) AS checkout_processando
    `,
    [
      negocioId,
      STATUS_RESERVA_ATIVA,
    ]
  );

  return result.rows[0] || {
    agendamentos_confirmados: 0,
    acesso_pago_ativo: false,
    checkout_pendente: false,
    operacao_financeira_pendente: false,
    checkout_processando: false,
  };
}

async function arquivarNegocio({
  negocioId,
  usuarioId,
  motivo,
  executor = db,
}) {
  const result = await executor.query(
    `
      UPDATE negocios
      SET
        ativo = FALSE,
        publicado = FALSE,
        despublicado_manual_em = NULL,
        arquivado_em = NOW(),
        arquivado_por = $2,
        motivo_arquivamento = $3,
        updated_at = NOW()
      WHERE id = $1
        AND ativo = TRUE
        AND arquivado_em IS NULL
      RETURNING
        id,
        nome,
        slug,
        ativo,
        publicado,
        arquivado_em,
        arquivado_por,
        motivo_arquivamento
    `,
    [negocioId, usuarioId, motivo]
  );

  return result.rows[0] || null;
}

async function cancelarConvitesPendentes(
  negocioId,
  executor = db
) {
  const result = await executor.query(
    `
      UPDATE convites_profissionais
      SET
        status = 'cancelado',
        respondido_em = COALESCE(respondido_em, NOW()),
        updated_at = NOW()
      WHERE negocio_id = $1
        AND status = 'pendente'
      RETURNING id
    `,
    [negocioId]
  );

  return result.rowCount || 0;
}

async function contarReservasAtivasProfissional(
  usuarioId,
  executor = db
) {
  const result = await executor.query(
    `
      SELECT COUNT(*)::int AS total
      FROM agendamentos
      WHERE profissional_id = $1
        AND status = ANY($2::text[])
    `,
    [usuarioId, STATUS_RESERVA_ATIVA]
  );

  return Number(result.rows[0]?.total || 0);
}

async function listarReservasAtivasCliente(
  usuarioId,
  executor = db
) {
  const result = await executor.query(
    `
      SELECT
        a.id,
        a.cliente_id,
        a.status,
        a.antecedencia_cancelamento_horas,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS horario,
        a.servico_nome,
        COALESCE(
          NULLIF(BTRIM(un.nome_exibicao), ''),
          profissional.nome
        ) AS profissional_nome,
        n.nome AS negocio_nome,
        COALESCE(
          NULLIF(n.fuso_horario, ''),
          'America/Sao_Paulo'
        ) AS fuso_horario
      FROM agendamentos a
      INNER JOIN negocios n
        ON n.id = a.negocio_id
      INNER JOIN usuarios profissional
        ON profissional.id = a.profissional_id
      LEFT JOIN usuarios_negocios un
        ON un.usuario_id = a.profissional_id
        AND un.negocio_id = a.negocio_id
      WHERE a.cliente_id = $1
        AND a.status = ANY($2::text[])
      ORDER BY a.data, a.horario, a.id
    `,
    [usuarioId, STATUS_RESERVA_ATIVA]
  );

  return result.rows;
}

async function buscarReservaClienteDesativado(
  agendamentoId,
  executor = db,
  { bloquear = false } = {}
) {
  const result = await executor.query(
    `
      SELECT
        a.id,
        a.negocio_id,
        a.profissional_id,
        a.cliente_id,
        a.status,
        a.antecedencia_cancelamento_horas,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS horario,
        a.servico_nome,
        COALESCE(
          NULLIF(BTRIM(un.nome_exibicao), ''),
          profissional.nome
        ) AS profissional_nome,
        n.nome AS negocio_nome,
        COALESCE(
          NULLIF(n.fuso_horario, ''),
          'America/Sao_Paulo'
        ) AS fuso_horario,
        u.desativado_em,
        u.encerrado_definitivo_em
      FROM agendamentos a
      INNER JOIN negocios n
        ON n.id = a.negocio_id
      INNER JOIN usuarios profissional
        ON profissional.id = a.profissional_id
      LEFT JOIN usuarios_negocios un
        ON un.usuario_id = a.profissional_id
        AND un.negocio_id = a.negocio_id
      INNER JOIN usuarios u
        ON u.id = a.cliente_id
        AND u.ativo = FALSE
        AND u.desativado_em IS NOT NULL
      WHERE a.id = $1
      LIMIT 1
      ${bloquear ? "FOR UPDATE OF a" : ""}
    `,
    [agendamentoId]
  );

  return result.rows[0] || null;
}

async function desativarUsuario(
  usuarioId,
  executor = db
) {
  const result = await executor.query(
    `
      UPDATE usuarios
      SET
        ativo = FALSE,
        desativado_em = COALESCE(desativado_em, NOW()),
        updated_at = NOW()
      WHERE id = $1
        AND ativo = TRUE
      RETURNING
        id,
        ativo,
        desativado_em,
        encerrado_definitivo_em
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function encerrarUsuarioDefinitivamente(
  usuarioId,
  executor = db
) {
  const result = await executor.query(
    `
      UPDATE usuarios
      SET
        ativo = FALSE,
        desativado_em = COALESCE(desativado_em, NOW()),
        encerrado_definitivo_em = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND encerrado_definitivo_em IS NULL
      RETURNING
        id,
        ativo,
        desativado_em,
        encerrado_definitivo_em
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

module.exports = {
  bloquearUsuario,
  buscarNegocioOperacionalDoDono,
  buscarPendenciasNegocio,
  arquivarNegocio,
  cancelarConvitesPendentes,
  contarReservasAtivasProfissional,
  listarReservasAtivasCliente,
  buscarReservaClienteDesativado,
  desativarUsuario,
  encerrarUsuarioDefinitivamente,
};
