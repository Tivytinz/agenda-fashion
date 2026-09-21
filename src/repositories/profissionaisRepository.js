const db = require("../db/db");

async function bloquearCadastroProfissional(client, negocioId) {
  await client.query(
    `
    SELECT pg_advisory_xact_lock(
      hashtext('agenda_fashion_limite_profissionais'),
      $1::integer
    )
    `,
    [Number(negocioId)]
  );
}

async function buscarPlanoDoNegocio(negocioId, executor = db) {
  const result = await executor.query(
    `
    SELECT
      p.id,
      p.nome,
      p.slug,
      p.limite_profissionais
    FROM negocios n
    INNER JOIN planos p
      ON p.id = n.plano_id
    WHERE n.id = $1
    LIMIT 1
    `,
    [negocioId]
  );

  return result.rows[0] || null;
}

async function contarProfissionaisAtivos(negocioId, executor = db) {
  const result = await executor.query(
    `
    SELECT COUNT(*)::int AS total
    FROM usuarios_negocios
    WHERE negocio_id = $1
      AND ativo = TRUE
      AND papel IN ('dono', 'profissional')
    `,
    [negocioId]
  );

  return Number(result.rows[0]?.total || 0);
}

async function buscarNegocioDono(usuarioId) {
  const result = await db.query(
    `
    SELECT un.negocio_id
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    WHERE un.usuario_id = $1
      AND un.papel = 'dono'
      AND un.ativo = TRUE
      AND u.ativo = TRUE
      AND n.ativo = TRUE
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function listarProfissionaisDoNegocio(negocioId) {
  const result = await db.query(
    `
    SELECT
      u.id,
      COALESCE(un.nome_exibicao, u.nome) AS nome,
      CASE
        WHEN un.ativo = TRUE
          THEN COALESCE(un.whatsapp_exibicao, u.whatsapp)
        ELSE NULL
      END AS whatsapp,
      u.foto_url,
      un.papel,
      un.ativo,
      un.motivo_inatividade
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    WHERE un.negocio_id = $1
      AND u.ativo = TRUE
      AND un.papel IN ('dono', 'profissional')
      AND (
        un.ativo = TRUE
        OR (
          un.papel = 'profissional'
          AND un.ativo = FALSE
          AND un.motivo_inatividade = 'aguardando_vaga_plano'
        )
      )
    ORDER BY
      CASE
        WHEN un.papel = 'dono' THEN 0
        WHEN un.ativo = TRUE THEN 1
        ELSE 2
      END,
      COALESCE(un.nome_exibicao, u.nome) ASC
    `,
    [negocioId]
  );

  return result.rows;
}

async function verificarProfissionalNoNegocio(usuarioId, negocioId) {
  const result = await db.query(
    `
    SELECT un.id
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    WHERE un.usuario_id = $1
      AND un.negocio_id = $2
      AND un.ativo = TRUE
      AND u.ativo = TRUE
    LIMIT 1
    `,
    [usuarioId, negocioId]
  );

  return result.rows[0] || null;
}

async function atualizarProfissional(id, negocioId, nome, whatsapp) {
  const result = await db.query(
    `
    UPDATE usuarios_negocios un
    SET
      nome_exibicao = $1,
      whatsapp_exibicao = $2
    FROM usuarios u
    WHERE un.usuario_id = $3
      AND un.negocio_id = $4
      AND un.ativo = TRUE
      AND u.id = un.usuario_id
      AND u.ativo = TRUE
    RETURNING
      u.id,
      COALESCE(un.nome_exibicao, u.nome) AS nome,
      COALESCE(un.whatsapp_exibicao, u.whatsapp) AS whatsapp,
      u.foto_url,
      un.ativo
    `,
    [nome, whatsapp, id, negocioId]
  );

  return result.rows[0];
}

async function removerVinculo(usuarioId, negocioId) {
  return db.executarTransacao(async (client) => {
    const vinculo = await client.query(
      `
      SELECT id, ativo
      FROM usuarios_negocios
      WHERE usuario_id = $1
        AND negocio_id = $2
        AND papel = 'profissional'
      LIMIT 1
      FOR UPDATE
      `,
      [usuarioId, negocioId]
    );

    const vinculoAtual = vinculo.rows[0] || null;

    if (!vinculoAtual) {
      return {
        removido: null,
        agendamentosFuturos: 0,
      };
    }

    const compromissos = await client.query(
      `
      SELECT COUNT(*)::int AS total
      FROM agendamentos a
      INNER JOIN negocios n
        ON n.id = a.negocio_id
      WHERE a.profissional_id = $1
        AND a.negocio_id = $2
        AND a.status IN ('agendado', 'confirmado')
        AND (a.data + a.horario) > (
          CURRENT_TIMESTAMP AT TIME ZONE COALESCE(
            NULLIF(n.fuso_horario, ''),
            'America/Sao_Paulo'
          )
        )
      `,
      [usuarioId, negocioId]
    );

    const agendamentosFuturos = Number(
      compromissos.rows[0]?.total || 0
    );

    if (agendamentosFuturos > 0) {
      return {
        removido: null,
        agendamentosFuturos,
      };
    }

    const result = await client.query(
      `
      DELETE FROM usuarios_negocios
      WHERE id = $1
      RETURNING id
      `,
      [vinculoAtual.id]
    );

    return {
      removido: result.rows[0] || null,
      agendamentosFuturos: 0,
    };
  });
}

async function buscarProfissionalPorEmailWhatsapp(email, whatsapp) {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.nome,
      u.foto_url
    FROM usuarios u
    WHERE u.ativo = TRUE
      AND (
        (
          $1 <> ''
          AND LOWER(u.email) = $1
        )
        OR REGEXP_REPLACE(
          COALESCE(u.whatsapp, ''),
          '\\D',
          '',
          'g'
        ) = NULLIF($2, '')
      )
    LIMIT 1
    `,
    [email, whatsapp]
  );

  return result.rows[0] || null;
}

async function verificarVinculo(
  usuarioId,
  negocioId,
  executor = db
) {
  const result = await executor.query(
    `
    SELECT id, papel, ativo, motivo_inatividade
    FROM usuarios_negocios
    WHERE usuario_id = $1
      AND negocio_id = $2
    LIMIT 1
    `,
    [usuarioId, negocioId]
  );

  return result.rows[0] || null;
}

async function buscarVinculoProfissionalAtivo(
  usuarioId,
  executor = db
) {
  const result = await executor.query(
    `
    SELECT
      un.id,
      un.negocio_id,
      n.nome AS negocio_nome
    FROM usuarios_negocios un
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    WHERE un.usuario_id = $1
      AND un.papel = 'profissional'
      AND un.ativo = TRUE
      AND n.ativo = TRUE
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function criarVinculo(
  usuarioId,
  negocioId,
  executor = db
) {
  await executor.query(
    `
    INSERT INTO usuarios_negocios(
      usuario_id,
      negocio_id,
      papel
    )
    VALUES($1,$2,'profissional')
    `,
    [usuarioId, negocioId]
  );
}

async function criarOuMarcarVinculoAguardandoVaga(
  usuarioId,
  negocioId,
  executor = db
) {
  const result = await executor.query(
    `
    INSERT INTO usuarios_negocios (
      usuario_id,
      negocio_id,
      papel,
      ativo,
      motivo_inatividade
    )
    VALUES (
      $1,
      $2,
      'profissional',
      FALSE,
      'aguardando_vaga_plano'
    )
    ON CONFLICT (usuario_id, negocio_id)
    DO UPDATE SET
      papel = 'profissional',
      ativo = FALSE,
      motivo_inatividade = 'aguardando_vaga_plano',
      updated_at = NOW()
    WHERE usuarios_negocios.ativo = FALSE
    RETURNING id, papel, ativo, motivo_inatividade
    `,
    [usuarioId, negocioId]
  );

  return result.rows[0] || null;
}

async function reativarVinculoProfissional(
  usuarioId,
  negocioId,
  executor = db
) {
  const result = await executor.query(
    `
    UPDATE usuarios_negocios
    SET
      papel = 'profissional',
      ativo = TRUE,
      motivo_inatividade = NULL,
      updated_at = NOW()
    WHERE usuario_id = $1
      AND negocio_id = $2
      AND ativo = FALSE
    RETURNING id, papel, ativo, motivo_inatividade
    `,
    [usuarioId, negocioId]
  );

  return result.rows[0] || null;
}

async function ativarVinculoProfissionalAguardandoVaga(
  usuarioId,
  negocioId,
  executor = db
) {
  const result = await executor.query(
    `
    UPDATE usuarios_negocios un
    SET
      ativo = TRUE,
      motivo_inatividade = NULL,
      updated_at = NOW()
    FROM usuarios u, negocios n
    WHERE un.usuario_id = $1
      AND un.negocio_id = $2
      AND un.papel = 'profissional'
      AND un.ativo = FALSE
      AND un.motivo_inatividade = 'aguardando_vaga_plano'
      AND u.id = un.usuario_id
      AND u.ativo = TRUE
      AND n.id = un.negocio_id
      AND n.ativo = TRUE
    RETURNING un.id, un.papel, un.ativo, un.motivo_inatividade
    `,
    [usuarioId, negocioId]
  );

  return result.rows[0] || null;
}

async function expirarConvitesPendentes(
  negocioId,
  usuarioConvidadoId,
  executor = db
) {
  await executor.query(
    `
    UPDATE convites_profissionais
    SET
      status = 'expirado',
      respondido_em = COALESCE(respondido_em, NOW())
    WHERE negocio_id = $1
      AND usuario_convidado_id = $2
      AND status = 'pendente'
      AND expira_em <= NOW()
    `,
    [negocioId, usuarioConvidadoId]
  );
}

async function buscarConvitePendente(
  negocioId,
  usuarioConvidadoId,
  executor = db
) {
  const result = await executor.query(
    `
    SELECT
      id,
      negocio_id,
      usuario_convidado_id,
      status,
      expira_em,
      created_at
    FROM convites_profissionais
    WHERE negocio_id = $1
      AND usuario_convidado_id = $2
      AND status = 'pendente'
      AND expira_em > NOW()
    LIMIT 1
    `,
    [negocioId, usuarioConvidadoId]
  );

  return result.rows[0] || null;
}

async function criarConvite(
  {
    negocioId,
    usuarioConvidadoId,
    convidadoPorUsuarioId,
    expiraEm,
  },
  executor = db
) {
  const result = await executor.query(
    `
    INSERT INTO convites_profissionais (
      negocio_id,
      usuario_convidado_id,
      convidado_por_usuario_id,
      status,
      expira_em
    )
    VALUES ($1, $2, $3, 'pendente', $4)
    ON CONFLICT (negocio_id, usuario_convidado_id)
    WHERE status = 'pendente'
    DO NOTHING
    RETURNING
      id,
      negocio_id,
      usuario_convidado_id,
      status,
      expira_em,
      created_at
    `,
    [
      negocioId,
      usuarioConvidadoId,
      convidadoPorUsuarioId,
      expiraEm,
    ]
  );

  return result.rows[0] || null;
}

async function listarConvitesRecebidos(usuarioId) {
  const result = await db.query(
    `
    SELECT
      cp.id,
      cp.negocio_id,
      n.nome AS negocio_nome,
      n.foto_url AS negocio_foto_url,
      cp.status,
      cp.expira_em,
      cp.created_at
    FROM convites_profissionais cp
    INNER JOIN negocios n
      ON n.id = cp.negocio_id
    WHERE cp.usuario_convidado_id = $1
      AND cp.status = 'pendente'
      AND cp.expira_em > NOW()
      AND n.ativo = TRUE
    ORDER BY cp.created_at DESC
    `,
    [usuarioId]
  );

  return result.rows;
}

async function buscarConviteParaAtualizacao(
  conviteId,
  executor = db
) {
  const result = await executor.query(
    `
    SELECT
      cp.id,
      cp.negocio_id,
      cp.usuario_convidado_id,
      cp.status,
      cp.expira_em,
      n.ativo AS negocio_ativo,
      u.ativo AS usuario_ativo
    FROM convites_profissionais cp
    INNER JOIN negocios n
      ON n.id = cp.negocio_id
    INNER JOIN usuarios u
      ON u.id = cp.usuario_convidado_id
    WHERE cp.id = $1
    LIMIT 1
    FOR UPDATE OF cp
    `,
    [conviteId]
  );

  return result.rows[0] || null;
}

async function atualizarStatusConvite(
  conviteId,
  status,
  executor = db
) {
  const result = await executor.query(
    `
    UPDATE convites_profissionais
    SET
      status = $2,
      respondido_em = NOW()
    WHERE id = $1
    RETURNING
      id,
      negocio_id,
      usuario_convidado_id,
      status,
      expira_em,
      respondido_em
    `,
    [conviteId, status]
  );

  return result.rows[0] || null;
}

module.exports = {
  bloquearCadastroProfissional,
  buscarPlanoDoNegocio,
  contarProfissionaisAtivos,
  buscarNegocioDono,
  listarProfissionaisDoNegocio,
  verificarProfissionalNoNegocio,
  atualizarProfissional,
  removerVinculo,
  buscarProfissionalPorEmailWhatsapp,
  verificarVinculo,
  buscarVinculoProfissionalAtivo,
  criarVinculo,
  criarOuMarcarVinculoAguardandoVaga,
  reativarVinculoProfissional,
  ativarVinculoProfissionalAguardandoVaga,
  expirarConvitesPendentes,
  buscarConvitePendente,
  criarConvite,
  listarConvitesRecebidos,
  buscarConviteParaAtualizacao,
  atualizarStatusConvite,
};
