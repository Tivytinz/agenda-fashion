const db = require("../db/db");

/*
 * Busca somente dados seguros para
 * exibição na tela Minha conta.
 *
 * A senha nunca é retornada aqui.
 */
async function buscarUsuarioPorId(
  usuarioId
) {
  const resultado =
    await db.query(
      `
        SELECT
          id,
          nome,
          email,
          whatsapp,
          whatsapp_notificacoes_consentido_em,
          whatsapp_notificacoes_cancelado_em,
          (
            whatsapp_notificacoes_consentido_em IS NOT NULL
            AND whatsapp_notificacoes_cancelado_em IS NULL
          ) AS aceita_notificacoes_whatsapp,
          whatsapp_marketing_consentido_em,
          whatsapp_marketing_cancelado_em,
          (
            whatsapp_marketing_consentido_em IS NOT NULL
            AND whatsapp_marketing_cancelado_em IS NULL
          ) AS aceita_lembretes_whatsapp,
          foto_url,
          foto_public_id,
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
      [usuarioId]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

/*
 * Usado exclusivamente durante
 * a alteração da senha.
 */
async function buscarSenhaUsuario(
  usuarioId
) {
  const resultado =
    await db.query(
      `
        SELECT
          id,
          senha,
          ativo,
          senha_alterada_em

        FROM usuarios

        WHERE id = $1

        LIMIT 1
      `,
      [usuarioId]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

async function atualizarUsuario({
  usuarioId,
  nome,
  whatsapp,
}) {
  const resultado =
    await db.query(
      `
        UPDATE usuarios

        SET
          nome = $1,
          whatsapp = $2

        WHERE id = $3
          AND ativo = TRUE

        RETURNING
          id,
          nome,
          email,
          whatsapp,
          whatsapp_notificacoes_consentido_em,
          whatsapp_notificacoes_cancelado_em,
          (
            whatsapp_notificacoes_consentido_em IS NOT NULL
            AND whatsapp_notificacoes_cancelado_em IS NULL
          ) AS aceita_notificacoes_whatsapp,
          whatsapp_marketing_consentido_em,
          whatsapp_marketing_cancelado_em,
          (
            whatsapp_marketing_consentido_em IS NOT NULL
            AND whatsapp_marketing_cancelado_em IS NULL
          ) AS aceita_lembretes_whatsapp,
          foto_url,
          foto_public_id,
          ativo,
          email_verificado_em,
          ultimo_login_em,
          senha_alterada_em,
          created_at,
          updated_at
      `,
      [
        nome,
        whatsapp,
        usuarioId,
      ]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

async function atualizarSenha({
  usuarioId,
  senhaHash,
}) {
  const resultado =
    await db.query(
      `
        UPDATE usuarios

        SET
          senha = $1,
          senha_alterada_em = NOW()

        WHERE id = $2
          AND ativo = TRUE

        RETURNING
          id,
          senha_alterada_em,
          updated_at
      `,
      [
        senhaHash,
        usuarioId,
      ]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

async function atualizarPreferenciaWhatsapp({
  usuarioId,
  aceitaLembretes
}) {
  const resultado = await db.query(
    `
      UPDATE usuarios

      SET
        whatsapp_marketing_consentido_em =
          CASE
            WHEN $1::BOOLEAN
              THEN COALESCE(
                whatsapp_marketing_consentido_em,
                NOW()
              )
            ELSE whatsapp_marketing_consentido_em
          END,
        whatsapp_marketing_cancelado_em =
          CASE
            WHEN $1::BOOLEAN THEN NULL
            ELSE NOW()
          END

      WHERE id = $2
        AND ativo = TRUE

      RETURNING
        id,
        whatsapp_marketing_consentido_em,
        whatsapp_marketing_cancelado_em,
        (
          whatsapp_marketing_consentido_em IS NOT NULL
          AND whatsapp_marketing_cancelado_em IS NULL
        ) AS aceita_lembretes_whatsapp
    `,
    [
      aceitaLembretes,
      usuarioId,
    ]
  );

  return resultado.rows[0] || null;
}

async function atualizarNotificacoesWhatsapp({
  usuarioId,
  aceitaNotificacoes
}) {
  const resultado = await db.query(
    `
      UPDATE usuarios

      SET
        whatsapp_notificacoes_consentido_em =
          CASE
            WHEN $1::BOOLEAN
              THEN COALESCE(
                whatsapp_notificacoes_consentido_em,
                NOW()
              )
            ELSE whatsapp_notificacoes_consentido_em
          END,
        whatsapp_notificacoes_cancelado_em =
          CASE
            WHEN $1::BOOLEAN THEN NULL
            ELSE NOW()
          END

      WHERE id = $2
        AND ativo = TRUE

      RETURNING
        id,
        whatsapp_notificacoes_consentido_em,
        whatsapp_notificacoes_cancelado_em,
        (
          whatsapp_notificacoes_consentido_em IS NOT NULL
          AND whatsapp_notificacoes_cancelado_em IS NULL
        ) AS aceita_notificacoes_whatsapp
    `,
    [
      aceitaNotificacoes,
      usuarioId,
    ]
  );

  return resultado.rows[0] || null;
}

async function atualizarFotoUsuario({
  usuarioId,
  fotoUrl,
  fotoPublicId,
}) {
  const resultado =
    await db.query(
      `
        UPDATE usuarios

        SET
          foto_url = $1,
          foto_public_id = $2

        WHERE id = $3
          AND ativo = TRUE

        RETURNING
          id,
          nome,
          email,
          whatsapp,
          whatsapp_notificacoes_consentido_em,
          whatsapp_notificacoes_cancelado_em,
          (
            whatsapp_notificacoes_consentido_em IS NOT NULL
            AND whatsapp_notificacoes_cancelado_em IS NULL
          ) AS aceita_notificacoes_whatsapp,
          whatsapp_marketing_consentido_em,
          whatsapp_marketing_cancelado_em,
          (
            whatsapp_marketing_consentido_em IS NOT NULL
            AND whatsapp_marketing_cancelado_em IS NULL
          ) AS aceita_lembretes_whatsapp,
          foto_url,
          foto_public_id,
          ativo,
          email_verificado_em,
          ultimo_login_em,
          senha_alterada_em,
          created_at,
          updated_at
      `,
      [
        fotoUrl,
        fotoPublicId,
        usuarioId,
      ]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

module.exports = {
  buscarUsuarioPorId,
  buscarSenhaUsuario,
  atualizarUsuario,
  atualizarPreferenciaWhatsapp,
  atualizarNotificacoesWhatsapp,
  atualizarSenha,
  atualizarFotoUsuario,
};
