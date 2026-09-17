const db = require("../db/db");
const {
  TIPOS_NEGOCIO,
  normalizarTelefoneNacional,
} = require("./whatsappMensagemRepositoryConfig");

async function cancelarMensagensExpiradas() {
  const result =
    await db.query(
      `
        UPDATE whatsapp_mensagens

        SET
          status = 'CANCELED',
          bloqueado_em = NULL,
          ultimo_erro =
            'Mensagem expirada antes do envio.'

        WHERE status IN (
            'PENDING',
            'FAILED',
            'PROCESSING'
          )
          AND expira_em
            <= NOW()

        RETURNING id
      `
    );

  return result.rowCount || 0;
}

async function cancelarMarketingPorWhatsapp(
  telefone
) {
  const telefoneNacional =
    normalizarTelefoneNacional(
      telefone
    );

  if (!telefoneNacional) {
    return {
      usuarios: 0,
      mensagensCanceladas: 0,
    };
  }

  return db.executarTransacao(
    async (executor) => {
      const usuarios =
        await executor.query(
          `
            UPDATE usuarios
            SET
              whatsapp_marketing_cancelado_em =
                NOW()
            WHERE ativo = TRUE
              AND whatsapp_marketing_consentido_em
                IS NOT NULL
              AND whatsapp_marketing_cancelado_em
                IS NULL
              AND REGEXP_REPLACE(
                whatsapp,
                '[^0-9]',
                '',
                'g'
              ) = $1
            RETURNING
              id,
              whatsapp
          `,
          [telefoneNacional]
        );

      if (usuarios.rowCount > 0) {
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
            SELECT
              usuario_cancelado.id,
              usuario_cancelado.whatsapp,
              'MARKETING_PROFISSIONAL',
              'CANCELADO',
              'WHATSAPP',
              'optout-whatsapp-v1'
            FROM JSONB_TO_RECORDSET($1::JSONB)
              AS usuario_cancelado(
                id BIGINT,
                whatsapp VARCHAR(13)
              )
          `,
          [JSON.stringify(usuarios.rows)]
        );
      }

      const mensagens =
        await executor.query(
          `
            UPDATE whatsapp_mensagens
            SET
              status = 'CANCELED',
              bloqueado_em = NULL,
              ultimo_erro =
                'Marketing cancelado pelo destinatário no WhatsApp.'
            WHERE tipo = ANY($1::VARCHAR[])
              AND destinatario = ANY($2::VARCHAR[])
              AND status IN (
                'PENDING',
                'FAILED',
                'PROCESSING'
              )
            RETURNING id
          `,
          [
            TIPOS_NEGOCIO,
            [
              telefoneNacional,
              `55${telefoneNacional}`,
            ],
          ]
        );

      return {
        usuarios:
          usuarios.rowCount || 0,
        mensagensCanceladas:
          mensagens.rowCount || 0,
      };
    }
  );
}

async function cancelarTodasComunicacoesPorWhatsapp(
  telefone
) {
  const telefoneNacional =
    normalizarTelefoneNacional(
      telefone
    );

  if (!telefoneNacional) {
    return {
      usuarios: 0,
      agendamentos: 0,
      mensagensCanceladas: 0,
    };
  }

  return db.executarTransacao(
    async (executor) => {
      const usuarios =
        await executor.query(
          `
            WITH anteriores AS (
              SELECT
                id,
                whatsapp,
                (
                  whatsapp_notificacoes_consentido_em
                    IS NOT NULL
                  AND whatsapp_notificacoes_cancelado_em
                    IS NULL
                ) AS cliente_ativo,
                (
                  whatsapp_operacional_consentido_em
                    IS NOT NULL
                  AND whatsapp_operacional_cancelado_em
                    IS NULL
                ) AS profissional_ativo,
                (
                  whatsapp_marketing_consentido_em
                    IS NOT NULL
                  AND whatsapp_marketing_cancelado_em
                    IS NULL
                ) AS marketing_ativo
              FROM usuarios
              WHERE ativo = TRUE
                AND REGEXP_REPLACE(
                  whatsapp,
                  '[^0-9]',
                  '',
                  'g'
                ) = $1
              FOR UPDATE
            ),
            atualizados AS (
              UPDATE usuarios usuario
              SET
                whatsapp_notificacoes_cancelado_em =
                  CASE
                    WHEN anterior.cliente_ativo
                      THEN NOW()
                    ELSE usuario.whatsapp_notificacoes_cancelado_em
                  END,
                whatsapp_operacional_cancelado_em =
                  CASE
                    WHEN anterior.profissional_ativo
                      THEN NOW()
                    ELSE usuario.whatsapp_operacional_cancelado_em
                  END,
                whatsapp_marketing_cancelado_em =
                  CASE
                    WHEN anterior.marketing_ativo
                      THEN NOW()
                    ELSE usuario.whatsapp_marketing_cancelado_em
                  END
              FROM anteriores anterior
              WHERE usuario.id = anterior.id
              RETURNING
                usuario.id,
                usuario.whatsapp,
                anterior.cliente_ativo,
                anterior.profissional_ativo,
                anterior.marketing_ativo
            )
            SELECT *
            FROM atualizados
            WHERE cliente_ativo
              OR profissional_ativo
              OR marketing_ativo
          `,
          [telefoneNacional]
        );

      if (usuarios.rowCount > 0) {
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
            SELECT
              usuario_cancelado.id,
              usuario_cancelado.whatsapp,
              preferencia.escopo,
              'CANCELADO',
              'WHATSAPP',
              'optout-global-whatsapp-v1'
            FROM JSONB_TO_RECORDSET($1::JSONB)
              AS usuario_cancelado(
                id BIGINT,
                whatsapp VARCHAR(13),
                cliente_ativo BOOLEAN,
                profissional_ativo BOOLEAN,
                marketing_ativo BOOLEAN
              )
            CROSS JOIN LATERAL (
              VALUES
                (
                  usuario_cancelado.cliente_ativo,
                  'OPERACIONAL_CLIENTE'
                ),
                (
                  usuario_cancelado.profissional_ativo,
                  'OPERACIONAL_PROFISSIONAL'
                ),
                (
                  usuario_cancelado.marketing_ativo,
                  'MARKETING_PROFISSIONAL'
                )
            ) AS preferencia(ativa, escopo)
            WHERE preferencia.ativa
          `,
          [JSON.stringify(usuarios.rows)]
        );
      }

      const agendamentos =
        await executor.query(
          `
            WITH revogados AS (
              UPDATE agendamentos agendamento
              SET
                whatsapp_consentido_em = NULL
              WHERE agendamento.whatsapp_consentido_em
                  IS NOT NULL
                AND REGEXP_REPLACE(
                  agendamento.cliente_whatsapp,
                  '[^0-9]',
                  '',
                  'g'
                ) = ANY(
                  ARRAY[
                    $1,
                    '55' || $1
                  ]::TEXT[]
                )
              RETURNING
                agendamento.id,
                agendamento.cliente_id,
                $1::VARCHAR AS telefone
            )
            INSERT INTO whatsapp_consentimentos (
              usuario_id,
              agendamento_id,
              telefone,
              escopo,
              acao,
              origem,
              texto_versao
            )
            SELECT
              revogado.cliente_id,
              revogado.id,
              revogado.telefone,
              'OPERACIONAL_CLIENTE',
              'CANCELADO',
              'WHATSAPP',
              'optout-global-agendamento-v1'
            FROM revogados revogado
            RETURNING agendamento_id
          `,
          [telefoneNacional]
        );

      const mensagens =
        await executor.query(
          `
            UPDATE whatsapp_mensagens
            SET
              status = 'CANCELED',
              bloqueado_em = NULL,
              ultimo_erro =
                'Mensagens canceladas pelo destinatário no WhatsApp.'
            WHERE destinatario = ANY($1::VARCHAR[])
              AND status IN (
                'PENDING',
                'FAILED',
                'PROCESSING'
              )
            RETURNING id
          `,
          [[
            telefoneNacional,
            `55${telefoneNacional}`,
          ]]
        );

      return {
        usuarios:
          usuarios.rowCount || 0,
        agendamentos:
          agendamentos.rowCount || 0,
        mensagensCanceladas:
          mensagens.rowCount || 0,
      };
    }
  );
}

async function registrarInteracaoRecebida({
  metaMessageId,
  telefone,
  intencao,
  recebidoEm = new Date(),
}) {
  const result =
    await db.query(
      `
        INSERT INTO whatsapp_interacoes_recebidas (
          meta_message_id,
          telefone,
          intencao,
          recebido_em
        )

        VALUES (
          $1,
          $2,
          $3,
          $4
        )

        ON CONFLICT (
          meta_message_id
        )
        DO NOTHING

        RETURNING *
      `,
      [
        metaMessageId,
        String(telefone || "")
          .replace(/\D/g, ""),
        intencao,
        recebidoEm,
      ]
    );

  return result.rows[0] || null;
}

async function marcarInteracaoRespondida(
  interacaoId,
  metaMessageId
) {
  const result =
    await db.query(
      `
        UPDATE whatsapp_interacoes_recebidas

        SET
          status = 'RESPONDIDA',
          respondido_em = NOW(),
          resposta_meta_message_id = $2,
          ultimo_erro = NULL

        WHERE id = $1

        RETURNING *
      `,
      [
        interacaoId,
        metaMessageId || null,
      ]
    );

  return result.rows[0] || null;
}

async function marcarInteracaoSemResposta(
  interacaoId
) {
  const result =
    await db.query(
      `
        UPDATE whatsapp_interacoes_recebidas

        SET
          status = 'SEM_RESPOSTA',
          ultimo_erro = NULL

        WHERE id = $1

        RETURNING *
      `,
      [interacaoId]
    );

  return result.rows[0] || null;
}

async function marcarInteracaoFalha(
  interacaoId,
  erro
) {
  const result =
    await db.query(
      `
        UPDATE whatsapp_interacoes_recebidas

        SET
          status = 'FALHA',
          ultimo_erro = $2

        WHERE id = $1

        RETURNING *
      `,
      [
        interacaoId,
        String(
          erro ||
          "Falha ao responder pelo WhatsApp."
        ).slice(0, 2000),
      ]
    );

  return result.rows[0] || null;
}

async function marcarEnviada(
  mensagemId,
  metaMessageId
) {
  const result =
    await db.query(
      `
        UPDATE whatsapp_mensagens

        SET
          status = 'SENT',
          status_entrega =
            'ACCEPTED',
          status_entrega_em =
            NULL,
          enviado_em = NOW(),
          meta_message_id = $2,
          bloqueado_em = NULL,
          ultimo_erro = NULL

        WHERE id = $1
          AND status =
            'PROCESSING'

        RETURNING *
      `,
      [
        mensagemId,
        metaMessageId || null,
      ]
    );

  return result.rows[0] || null;
}

async function marcarFalha(
  mensagem,
  erro,
  atrasoSegundos,
  retentavel = true
) {
  const esgotada =
    !retentavel ||
    Number(mensagem.tentativas) >=
    Number(mensagem.max_tentativas);

  const result =
    await db.query(
      `
        UPDATE whatsapp_mensagens

        SET
          status = 'FAILED',
          falha_retentavel = $5,
          tentativas =
            CASE
              WHEN $5::BOOLEAN
                THEN tentativas
              ELSE max_tentativas
            END,
          bloqueado_em = NULL,
          ultimo_erro = $2,
          proxima_tentativa_em =
            CASE
              WHEN $3::BOOLEAN
                THEN proxima_tentativa_em
              ELSE
                NOW() +
                MAKE_INTERVAL(
                  secs => $4
                )
            END

        WHERE id = $1

        RETURNING *
      `,
      [
        mensagem.id,
        String(
          erro ||
          "Falha desconhecida."
        ).slice(
          0,
          2000
        ),
        esgotada,
        atrasoSegundos,
        retentavel,
      ]
    );

  return result.rows[0] || null;
}

async function registrarStatusEntrega({
  metaMessageId,
  status,
  ocorridoEm,
  codigoErro = null,
  tituloErro = null,
}) {
  const statusNormalizado =
    String(
      status ||
      ""
    ).toUpperCase();

  if (
    ![
      "SENT",
      "DELIVERED",
      "READ",
      "FAILED",
    ].includes(
      statusNormalizado
    )
  ) {
    return null;
  }

  const result =
    await db.query(
      `
        UPDATE whatsapp_mensagens

        SET
          status_entrega = $2,
          status_entrega_em = $3,
          entregue_em =
            CASE
              WHEN $2 IN (
                'DELIVERED',
                'READ'
              )
                THEN COALESCE(
                  entregue_em,
                  $3
                )
              ELSE entregue_em
            END,
          lida_em =
            CASE
              WHEN $2 = 'READ'
                THEN COALESCE(
                  lida_em,
                  $3
                )
              ELSE lida_em
            END,
          falhou_em =
            CASE
              WHEN $2 = 'FAILED'
                THEN COALESCE(
                  falhou_em,
                  $3
                )
              ELSE falhou_em
            END,
          meta_codigo_erro =
            CASE
              WHEN $2 = 'FAILED'
                THEN $4
              ELSE meta_codigo_erro
            END,
          ultimo_erro =
            CASE
              WHEN $2 = 'FAILED'
                THEN COALESCE(
                  $5,
                  ultimo_erro
                )
              ELSE ultimo_erro
            END

        WHERE meta_message_id = $1
          AND (
            status_entrega_em IS NULL
            OR $3 > status_entrega_em
            OR (
              $3 = status_entrega_em
              AND CASE $2
                WHEN 'SENT' THEN 1
                WHEN 'DELIVERED' THEN 2
                WHEN 'READ' THEN 3
                WHEN 'FAILED' THEN 4
                ELSE 0
              END >=
              CASE status_entrega
                WHEN 'ACCEPTED' THEN 0
                WHEN 'SENT' THEN 1
                WHEN 'DELIVERED' THEN 2
                WHEN 'READ' THEN 3
                WHEN 'FAILED' THEN 4
                ELSE 0
              END
            )
          )

        RETURNING *
      `,
      [
        metaMessageId,
        statusNormalizado,
        ocorridoEm,
        codigoErro
          ? String(codigoErro)
          : null,
        tituloErro
          ? String(tituloErro)
              .slice(0, 2000)
          : null,
      ]
    );

  return result.rows[0] || null;
}

async function marcarCancelada(
  mensagemId,
  motivo
) {
  const result =
    await db.query(
      `
        UPDATE whatsapp_mensagens

        SET
          status = 'CANCELED',
          bloqueado_em = NULL,
          ultimo_erro = $2

        WHERE id = $1

        RETURNING *
      `,
      [
        mensagemId,
        motivo || null,
      ]
    );

  return result.rows[0] || null;
}

module.exports = {
  cancelarMensagensExpiradas,
  cancelarMarketingPorWhatsapp,
  cancelarTodasComunicacoesPorWhatsapp,
  registrarInteracaoRecebida,
  marcarInteracaoRespondida,
  marcarInteracaoSemResposta,
  marcarInteracaoFalha,
  marcarEnviada,
  marcarFalha,
  marcarCancelada,
  registrarStatusEntrega,
};
