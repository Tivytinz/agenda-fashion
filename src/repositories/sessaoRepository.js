const db = require(
  "../db/db"
);

const PAPEIS_NEGOCIO = new Set([
  "dono",
  "profissional",
]);

function normalizarId(
  valor
) {
  const id = Number(valor);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

function normalizarPapel(
  valor
) {
  const papel = String(
    valor || ""
  )
    .trim()
    .toLowerCase();

  return PAPEIS_NEGOCIO.has(
    papel
  )
    ? papel
    : null;
}

/*
 * Busca os dados seguros da conta.
 *
 * A senha nunca é retornada.
 */
async function buscarUsuarioPorId(
  usuarioId
) {
  const id =
    normalizarId(usuarioId);

  if (!id) {
    return null;
  }

  const resultado =
    await db.query(
      `
      SELECT
        id,
        nome,
        email,
        foto_url,
        whatsapp,
        whatsapp_notificacoes_consentido_em,
        whatsapp_notificacoes_cancelado_em,

        CASE
          WHEN whatsapp_notificacoes_consentido_em IS NOT NULL
            AND whatsapp_notificacoes_cancelado_em IS NULL
            THEN TRUE
          ELSE FALSE
        END AS aceita_notificacoes_whatsapp,

        ativo,
        email_verificado_em,
        ultimo_login_em,
        senha_alterada_em,
        created_at,
        updated_at

      FROM usuarios

      WHERE id = $1

      LIMIT 1
      `,
      [id]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

/*
 * Busca a permissão administrativa ativa.
 *
 * A autorização final continua sendo feita
 * no backend em cada rota protegida.
 */
async function buscarAdministradorAtivoPorUsuarioId(
  usuarioId
) {
  const id =
    normalizarId(usuarioId);

  if (!id) {
    return null;
  }

  const resultado =
    await db.query(
      `
        SELECT
          ua.usuario_id,
          ua.papel

        FROM usuarios_administradores ua

        INNER JOIN usuarios u
          ON u.id = ua.usuario_id

        WHERE ua.usuario_id = $1
          AND ua.ativo = TRUE
          AND u.ativo = TRUE
          AND ua.papel IN (
            'admin',
            'superadmin'
          )

        LIMIT 1
      `,
      [id]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

/*
 * Lista todos os vínculos ativos da conta com negócios ativos.
 *
 * A ordenação continua priorizando dono apenas para compatibilidade com o
 * contexto principal legado. Fluxos contextuais devem selecionar o papel
 * explicitamente com buscarContextoAtivoPorPapel().
 */
async function buscarVinculosAtivosPorUsuarioId(
  usuarioId
) {
  const id =
    normalizarId(usuarioId);

  if (!id) {
    return [];
  }

  const resultado =
    await db.query(
      `
      SELECT
        un.id
          AS vinculo_id,

        un.papel,

        un.created_at
          AS vinculado_em,

        n.id
          AS negocio_id,

        n.nome
          AS negocio_nome,

        n.slug
          AS negocio_slug,

        n.descricao
          AS negocio_descricao,

        n.setor
          AS negocio_setor,

        n.whatsapp
          AS negocio_whatsapp,

        n.foto_url
          AS negocio_foto_url,

        n.cidade
          AS negocio_cidade,

        n.estado
          AS negocio_estado,

        n.bairro
          AS negocio_bairro,

        n.endereco
          AS negocio_endereco,

        n.numero
          AS negocio_numero,

        n.complemento
          AS negocio_complemento,

        n.cep
          AS negocio_cep,

        n.localizacao_url
          AS negocio_localizacao_url,

        n.latitude
          AS negocio_latitude,

        n.longitude
          AS negocio_longitude,

        n.fuso_horario
          AS negocio_fuso_horario,

        n.publicado
          AS negocio_publicado,

        n.created_at
          AS negocio_created_at,

        n.updated_at
          AS negocio_updated_at

      FROM usuarios_negocios un

      INNER JOIN usuarios u
        ON u.id = un.usuario_id

      INNER JOIN negocios n
        ON n.id = un.negocio_id

      WHERE un.usuario_id = $1
        AND un.ativo = TRUE
        AND u.ativo = TRUE
        AND n.ativo = TRUE

      ORDER BY
        CASE un.papel
          WHEN 'dono'
            THEN 1

          WHEN 'profissional'
            THEN 2

          ELSE 3
        END,

        un.created_at ASC,
        n.id ASC
      `,
      [id]
    );

  return resultado.rows;
}

async function buscarContextoAtivoPorPapel(
  usuarioId,
  papel
) {
  const papelNormalizado =
    normalizarPapel(
      papel
    );

  if (!papelNormalizado) {
    return null;
  }

  const vinculos =
    await buscarVinculosAtivosPorUsuarioId(
      usuarioId
    );

  return (
    vinculos.find(
      (vinculo) =>
        vinculo.papel ===
        papelNormalizado
    ) || null
  );
}

/*
 * Retorna o vínculo principal usado por compatibilidade no login.
 * Dono continua com prioridade, mas rotas /painel/* e /profissional/* não
 * devem depender desta seleção implícita para autorização ou isolamento.
 */
async function buscarContextoAtivoPorUsuarioId(
  usuarioId
) {
  const vinculos =
    await buscarVinculosAtivosPorUsuarioId(
      usuarioId
    );

  return vinculos[0] || null;
}

module.exports = {
  buscarUsuarioPorId,
  buscarAdministradorAtivoPorUsuarioId,
  buscarVinculosAtivosPorUsuarioId,
  buscarContextoAtivoPorPapel,
  buscarContextoAtivoPorUsuarioId,
};
