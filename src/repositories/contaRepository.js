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
        WITH anterior AS (
          SELECT
            id,
            whatsapp,
            (
              whatsapp_notificacoes_consentido_em IS NOT NULL
              AND whatsapp_notificacoes_cancelado_em IS NULL
            ) AS cliente_ativo,
            (
              whatsapp_operacional_consentido_em IS NOT NULL
              AND whatsapp_operacional_cancelado_em IS NULL
            ) AS operacional_ativo,
            (
              whatsapp_marketing_consentido_em IS NOT NULL
              AND whatsapp_marketing_cancelado_em IS NULL
            ) AS marketing_ativo
          FROM usuarios
          WHERE id = $3
            AND ativo = TRUE
          FOR UPDATE
        ),
        atualizado AS (
          UPDATE usuarios u
          SET
            nome = $1,
            whatsapp = $2,
            whatsapp_notificacoes_cancelado_em =
              CASE
                WHEN anterior.whatsapp IS DISTINCT FROM $2
                  AND anterior.cliente_ativo
                  THEN NOW()
                ELSE u.whatsapp_notificacoes_cancelado_em
              END,
            whatsapp_operacional_cancelado_em =
              CASE
                WHEN anterior.whatsapp IS DISTINCT FROM $2
                  AND anterior.operacional_ativo
                  THEN NOW()
                ELSE u.whatsapp_operacional_cancelado_em
              END,
            whatsapp_marketing_cancelado_em =
              CASE
                WHEN anterior.whatsapp IS DISTINCT FROM $2
                  AND anterior.marketing_ativo
                  THEN NOW()
                ELSE u.whatsapp_marketing_cancelado_em
              END
          FROM anterior
          WHERE u.id = anterior.id
          RETURNING
            u.id,
            u.nome,
            u.email,
            u.whatsapp,
            u.whatsapp_notificacoes_consentido_em,
            u.whatsapp_notificacoes_cancelado_em,
            (
              u.whatsapp_notificacoes_consentido_em IS NOT NULL
              AND u.whatsapp_notificacoes_cancelado_em IS NULL
            ) AS aceita_notificacoes_whatsapp,
            u.whatsapp_operacional_consentido_em,
            u.whatsapp_operacional_cancelado_em,
            (
              u.whatsapp_operacional_consentido_em IS NOT NULL
              AND u.whatsapp_operacional_cancelado_em IS NULL
            ) AS aceita_alertas_operacionais_whatsapp,
            u.whatsapp_marketing_consentido_em,
            u.whatsapp_marketing_cancelado_em,
            (
              u.whatsapp_marketing_consentido_em IS NOT NULL
              AND u.whatsapp_marketing_cancelado_em IS NULL
            ) AS aceita_lembretes_whatsapp,
            u.foto_url,
            u.foto_public_id,
            u.ativo,
            u.email_verificado_em,
            u.ultimo_login_em,
            u.senha_alterada_em,
            u.created_at,
            u.updated_at
        ),
        eventos AS (
          INSERT INTO whatsapp_consentimentos (
            usuario_id,
            telefone,
            escopo,
            acao,
            origem,
            texto_versao
          )
          SELECT
            anterior.id,
            anterior.whatsapp,
            evento.escopo,
            'CANCELADO',
            'MINHA_CONTA',
            'troca-telefone-v1'
          FROM anterior
          CROSS JOIN LATERAL (
            VALUES
              (
                anterior.cliente_ativo,
                'OPERACIONAL_CLIENTE'
              ),
              (
                anterior.operacional_ativo,
                'OPERACIONAL_PROFISSIONAL'
              ),
              (
                anterior.marketing_ativo,
                'MARKETING_PROFISSIONAL'
              )
          ) AS evento(ativo, escopo)
          WHERE anterior.whatsapp IS DISTINCT FROM $2
            AND evento.ativo
        )
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
          foto_url,
          foto_public_id,
          ativo,
          email_verificado_em,
          ultimo_login_em,
          senha_alterada_em,
          created_at,
          updated_at
        FROM atualizado
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
  escopo,
  consentido,
  origem = "MINHA_CONTA",
  textoVersao,
}) {
  const configuracoes = {
    cliente: {
      colunaConsentido:
        "whatsapp_notificacoes_consentido_em",
      colunaCancelado:
        "whatsapp_notificacoes_cancelado_em",
      escopoEvento:
        "OPERACIONAL_CLIENTE",
    },
    operacional: {
      colunaConsentido:
        "whatsapp_operacional_consentido_em",
      colunaCancelado:
        "whatsapp_operacional_cancelado_em",
      escopoEvento:
        "OPERACIONAL_PROFISSIONAL",
    },
    marketing: {
      colunaConsentido:
        "whatsapp_marketing_consentido_em",
      colunaCancelado:
        "whatsapp_marketing_cancelado_em",
      escopoEvento:
        "MARKETING_PROFISSIONAL",
    },
  };

  const configuracao =
    configuracoes[escopo];

  if (!configuracao) {
    throw new Error(
      "Escopo de preferência do WhatsApp inválido."
    );
  }

  return db.executarTransacao(
    async (executor) => {
      const resultado =
        await executor.query(
          `
            WITH anterior AS (
              SELECT
                id,
                (
                  ${configuracao.colunaConsentido} IS NOT NULL
                  AND ${configuracao.colunaCancelado} IS NULL
                ) AS ativo
              FROM usuarios
              WHERE id = $2
                AND ativo = TRUE
              FOR UPDATE
            )
            UPDATE usuarios u
            SET
              ${configuracao.colunaConsentido} =
                CASE
                  WHEN $1::BOOLEAN
                    AND ${configuracao.colunaCancelado} IS NOT NULL
                    THEN NOW()
                  WHEN $1::BOOLEAN
                    THEN COALESCE(
                      ${configuracao.colunaConsentido},
                      NOW()
                    )
                  ELSE ${configuracao.colunaConsentido}
                END,
              ${configuracao.colunaCancelado} =
                CASE
                  WHEN $1::BOOLEAN THEN NULL
                  WHEN anterior.ativo THEN NOW()
                  ELSE ${configuracao.colunaCancelado}
                END
            FROM anterior
            WHERE u.id = anterior.id
            RETURNING
              u.id,
              u.whatsapp,
              anterior.ativo AS estado_anterior,
              u.whatsapp_notificacoes_consentido_em,
              u.whatsapp_notificacoes_cancelado_em,
              (
                u.whatsapp_notificacoes_consentido_em IS NOT NULL
                AND u.whatsapp_notificacoes_cancelado_em IS NULL
              ) AS aceita_notificacoes_whatsapp,
              u.whatsapp_operacional_consentido_em,
              u.whatsapp_operacional_cancelado_em,
              (
                u.whatsapp_operacional_consentido_em IS NOT NULL
                AND u.whatsapp_operacional_cancelado_em IS NULL
              ) AS aceita_alertas_operacionais_whatsapp,
              u.whatsapp_marketing_consentido_em,
              u.whatsapp_marketing_cancelado_em,
              (
                u.whatsapp_marketing_consentido_em IS NOT NULL
                AND u.whatsapp_marketing_cancelado_em IS NULL
              ) AS aceita_lembretes_whatsapp
          `,
          [
            consentido,
            usuarioId,
          ]
        );

      const preferencia =
        resultado.rows[0] || null;

      const preferenciaPublica =
        preferencia
          ? Object.fromEntries(
              Object.entries(
                preferencia
              ).filter(
                ([chave]) =>
                  chave !==
                  "estado_anterior"
              )
            )
          : null;

      if (
        !preferencia ||
        Boolean(
          preferencia.estado_anterior
        ) === consentido ||
        !/^[0-9]{10,13}$/.test(
          String(
            preferencia.whatsapp ||
            ""
          )
        )
      ) {
        return preferenciaPublica;
      }

      await executor.query(
        `
          INSERT INTO whatsapp_consentimentos (
            usuario_id,
            telefone,
            escopo,
            acao,
            origem,
            texto_versao
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
        `,
        [
          usuarioId,
          preferencia.whatsapp,
          configuracao.escopoEvento,
          consentido
            ? "CONSENTIDO"
            : "CANCELADO",
          origem,
          textoVersao,
        ]
      );

      return preferenciaPublica;
    }
  );
}

async function atualizarNotificacoesWhatsapp({
  usuarioId,
  aceitaNotificacoes
}) {
  return atualizarPreferenciaWhatsapp({
    usuarioId,
    escopo: "cliente",
    consentido:
      aceitaNotificacoes,
    origem: "MINHA_CONTA",
    textoVersao:
      "conta-cliente-v1",
  });
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
