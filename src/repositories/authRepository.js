const db = require("../db/db");

const CAMPOS_USUARIO = `
  id,
  nome,
  email,
  senha,
  whatsapp,
  whatsapp_notificacoes_consentido_em,
  whatsapp_notificacoes_cancelado_em,
  (
    whatsapp_notificacoes_consentido_em IS NOT NULL
    AND whatsapp_notificacoes_cancelado_em IS NULL
  ) AS aceita_notificacoes_whatsapp,
  whatsapp_operacional_consentido_em,
  whatsapp_operacional_cancelado_em,
  (
    whatsapp_operacional_consentido_em IS NOT NULL
    AND whatsapp_operacional_cancelado_em IS NULL
  ) AS aceita_alertas_operacionais_whatsapp,
  whatsapp_marketing_consentido_em,
  whatsapp_marketing_cancelado_em,
  (
    whatsapp_marketing_consentido_em IS NOT NULL
    AND whatsapp_marketing_cancelado_em IS NULL
  ) AS aceita_lembretes_whatsapp,
  google_sub,
  ativo,
  email_verificado_em,
  ultimo_login_em,
  senha_alterada_em,
  created_at,
  updated_at
`;

async function buscarUsuarioPorEmail(
  email
) {
  const resultado =
    await db.query(
      `
      SELECT ${CAMPOS_USUARIO}
      FROM usuarios
      WHERE LOWER(email) =
        LOWER($1)
      LIMIT 1
      `,
      [email]
    );

  return resultado.rows[0] || null;
}

async function buscarUsuarioPorGoogleSub(
  googleSub
) {
  const resultado =
    await db.query(
      `
      SELECT ${CAMPOS_USUARIO}
      FROM usuarios
      WHERE google_sub = $1
      LIMIT 1
      `,
      [googleSub]
    );

  return resultado.rows[0] || null;
}

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
        whatsapp_operacional_consentido_em,
        whatsapp_operacional_cancelado_em,
        (
          whatsapp_operacional_consentido_em IS NOT NULL
          AND whatsapp_operacional_cancelado_em IS NULL
        ) AS aceita_alertas_operacionais_whatsapp,
        whatsapp_marketing_consentido_em,
        whatsapp_marketing_cancelado_em,
        (
          whatsapp_marketing_consentido_em IS NOT NULL
          AND whatsapp_marketing_cancelado_em IS NULL
        ) AS aceita_lembretes_whatsapp,
        google_sub,
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

  return resultado.rows[0] || null;
}

async function criarUsuario({
  nome,
  email,
  senha,
  whatsapp,
  aceitaAlertasWhatsapp = false,
  aceitaLembretesWhatsapp = false,
  aceitaNotificacoesWhatsapp = false,
}) {
  const resultado =
    await db.query(
      `
      WITH novo_usuario AS (
        INSERT INTO usuarios (
          nome,
          email,
          senha,
          whatsapp,
          whatsapp_notificacoes_consentido_em,
          whatsapp_notificacoes_cancelado_em,
          whatsapp_operacional_consentido_em,
          whatsapp_marketing_consentido_em
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          CASE
            WHEN $5::BOOLEAN THEN NOW()
            ELSE NULL
          END,
          CASE
            WHEN $5::BOOLEAN THEN NULL
            ELSE NOW()
          END,
          CASE
            WHEN $6::BOOLEAN THEN NOW()
            ELSE NULL
          END,
          CASE
            WHEN $7::BOOLEAN THEN NOW()
            ELSE NULL
          END
        )
        RETURNING ${CAMPOS_USUARIO}
      ),
      consentimentos AS (
        INSERT INTO whatsapp_consentimentos (
          usuario_id,
          telefone,
          escopo,
          acao,
          origem,
          texto_versao
        )
        SELECT
          novo_usuario.id,
          novo_usuario.whatsapp,
          consentimento.escopo,
          'CONSENTIDO',
          'CADASTRO',
          consentimento.texto_versao
        FROM novo_usuario
        CROSS JOIN (
          VALUES
            (
              $5::BOOLEAN,
              'OPERACIONAL_CLIENTE',
              'cadastro-cliente-v1'
            ),
            (
              $6::BOOLEAN,
              'OPERACIONAL_PROFISSIONAL',
              'cadastro-operacional-v1'
            ),
            (
              $7::BOOLEAN,
              'MARKETING_PROFISSIONAL',
              'cadastro-marketing-v2'
            )
        ) AS consentimento(
          consentido,
          escopo,
          texto_versao
        )
        WHERE consentimento.consentido
      )
      SELECT *
      FROM novo_usuario
      `,
      [
        nome,
        email,
        senha,
        whatsapp,
        aceitaNotificacoesWhatsapp,
        aceitaAlertasWhatsapp,
        aceitaLembretesWhatsapp,
      ]
    );

  return resultado.rows[0];
}

async function criarUsuarioGoogle({
  nome,
  email,
  googleSub,
  aceitaNotificacoesWhatsapp = false,
}) {
  const resultado =
    await db.query(
      `
      INSERT INTO usuarios (
        nome,
        email,
        senha,
        whatsapp,
        google_sub,
        email_verificado_em,
        whatsapp_notificacoes_consentido_em,
        whatsapp_notificacoes_cancelado_em
      )
      VALUES (
        $1,
        $2,
        NULL,
        NULL,
        $3,
        NOW(),
        CASE
          WHEN $4::BOOLEAN THEN NOW()
          ELSE NULL
        END,
        CASE
          WHEN $4::BOOLEAN THEN NULL
          ELSE NOW()
        END
      )
      RETURNING ${CAMPOS_USUARIO}
      `,
      [
        nome,
        email,
        googleSub,
        aceitaNotificacoesWhatsapp,
      ]
    );

  return resultado.rows[0];
}

async function vincularUsuarioAoGoogle({
  usuarioId,
  googleSub,
}) {
  const resultado =
    await db.query(
      `
      UPDATE usuarios
      SET
        google_sub = $2,
        email_verificado_em =
          COALESCE(
            email_verificado_em,
            NOW()
          )
      WHERE id = $1
        AND (
          google_sub IS NULL OR
          google_sub = $2
        )
      RETURNING ${CAMPOS_USUARIO}
      `,
      [usuarioId, googleSub]
    );

  return resultado.rows[0] || null;
}

async function atualizarUltimoLogin(
  usuarioId
) {
  const resultado =
    await db.query(
      `
      UPDATE usuarios
      SET ultimo_login_em = NOW()
      WHERE id = $1
      RETURNING ultimo_login_em
      `,
      [usuarioId]
    );

  return resultado.rows[0] || null;
}

async function atualizarSenha({
  usuarioId,
  senha,
}) {
  const resultado =
    await db.query(
      `
      UPDATE usuarios
      SET
        senha = $2,
        senha_alterada_em = NOW()
      WHERE id = $1
      RETURNING
        id,
        senha_alterada_em
      `,
      [usuarioId, senha]
    );

  return resultado.rows[0] || null;
}

async function desativarUsuario(
  usuarioId
) {
  const resultado =
    await db.query(
      `
      UPDATE usuarios
      SET ativo = FALSE
      WHERE id = $1
      RETURNING id, ativo
      `,
      [usuarioId]
    );

  return resultado.rows[0] || null;
}

module.exports = {
  buscarUsuarioPorEmail,
  buscarUsuarioPorGoogleSub,
  buscarUsuarioPorId,
  criarUsuario,
  criarUsuarioGoogle,
  vincularUsuarioAoGoogle,
  atualizarUltimoLogin,
  atualizarSenha,
  desativarUsuario,
};
