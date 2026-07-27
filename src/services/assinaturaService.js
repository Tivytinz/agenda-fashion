const db = require("../db/db");

const assinaturaRepository = require("../repositories/assinaturaRepository");
const pagamentoRepository = require("../repositories/pagamentoRepository");
const { criarAssinaturaAsaas } = require("./asaasService");
const { buscarUsoPlano } = require("./planoService");

async function registrarAssinaturaPendente(client, dados) {
  await assinaturaRepository.desativarAssinaturasDoNegocio(
    client,
    dados.negocio_id
  );

  return assinaturaRepository.criarAssinatura(client, {
    negocio_id: dados.negocio_id,
    plano_id: dados.plano_id,
    asaas_customer_id: dados.asaas_customer_id,
    asaas_subscription_id:
      dados.asaas_subscription_id || null,
    status: dados.status || "PENDING",
    forma_pagamento: dados.forma_pagamento,
    periodicidade: dados.periodicidade || "MONTHLY",
    valor: dados.valor,
    data_proxima_cobranca:
      dados.data_proxima_cobranca || null,
    ativo: false,
    observacoes: dados.observacoes || null
  });
}

async function registrarPagamento(client, dados) {
  return pagamentoRepository.criarPagamento(client, {
    assinatura_id: dados.assinatura_id,
    asaas_payment_id: dados.asaas_payment_id,
    valor: dados.valor,
    forma_pagamento: dados.forma_pagamento,
    status: dados.status || "PENDING",
    data_vencimento: dados.data_vencimento || null,
    data_pagamento: dados.data_pagamento || null,
    pix_copia_cola: dados.pix_copia_cola || null,
    pix_qrcode: dados.pix_qrcode || null
  });
}

function calcularProximaCobranca(dataBase = new Date()) {
  const data = new Date(dataBase);

  if (Number.isNaN(data.getTime())) {
    throw new Error(
      "Não foi possível calcular a próxima cobrança da assinatura."
    );
  }

  const ano = data.getUTCFullYear();
  const mesSeguinte = data.getUTCMonth() + 1;
  const diaAtual = data.getUTCDate();

  const ultimoDiaDoMesSeguinte = new Date(
    Date.UTC(ano, mesSeguinte + 1, 0)
  ).getUTCDate();

  const proximaCobranca = new Date(
    Date.UTC(
      ano,
      mesSeguinte,
      Math.min(
        diaAtual,
        ultimoDiaDoMesSeguinte
      )
    )
  );

  return proximaCobranca
    .toISOString()
    .slice(0, 10);
}

async function ativarAssinaturaPorPagamento(
  paymentId,
  statusPagamento = "CONFIRMED"
) {
  if (!paymentId) {
    throw new Error("Pagamento não informado.");
  }

  return db.executarTransacao(
    async (client) => {
      const resultado = await client.query(
        `
        SELECT
          p.id AS pagamento_id,
          p.data_pagamento,
          p.data_vencimento,
          a.*
        FROM pagamentos p
        INNER JOIN assinaturas a
          ON a.id = p.assinatura_id
        WHERE p.asaas_payment_id = $1
        LIMIT 1
        FOR UPDATE OF p, a
        `,
        [paymentId]
      );

      const assinatura =
        resultado.rows[0] || null;

      if (!assinatura) {
        return null;
      }

      await client.query(
        `
        UPDATE pagamentos
        SET
          status = $1,
          data_pagamento =
            COALESCE(data_pagamento, NOW())
        WHERE id = $2
        `,
        [
          statusPagamento,
          assinatura.pagamento_id
        ]
      );

      let asaasSubscriptionId =
        assinatura.asaas_subscription_id;

      let dataProximaCobranca =
        assinatura.data_proxima_cobranca;

      if (
        assinatura.forma_pagamento === "pix" &&
        !asaasSubscriptionId
      ) {
        dataProximaCobranca =
          calcularProximaCobranca(
            assinatura.data_pagamento ||
            assinatura.data_vencimento ||
            new Date()
          );

        const assinaturaAsaas =
          await criarAssinaturaAsaas({
            customerId:
              assinatura.asaas_customer_id,

            valor:
              assinatura.valor,

            descricao:
              "Agenda Fashion - Assinatura mensal",

            formaPagamento:
              "pix",

            externalReference:
              `assinatura:${assinatura.id};negocio:${assinatura.negocio_id};plano:${assinatura.plano_id}`,

            proximaCobranca:
              dataProximaCobranca
          });

        if (!assinaturaAsaas?.id) {
          throw new Error(
            "O Asaas não retornou o identificador da assinatura."
          );
        }

        asaasSubscriptionId =
          assinaturaAsaas.id;

        dataProximaCobranca =
          assinaturaAsaas.nextDueDate ||
          dataProximaCobranca;
      }

      await client.query(
        `
        UPDATE assinaturas
        SET ativo = FALSE
        WHERE negocio_id = $1
          AND id <> $2
        `,
        [
          assinatura.negocio_id,
          assinatura.id
        ]
      );

      const ativacao =
        await client.query(
          `
          UPDATE assinaturas
          SET
            asaas_subscription_id = $1,
            status = 'ACTIVE',
            data_proxima_cobranca = $2,
            ativo = TRUE,
            observacoes = $3
          WHERE id = $4
          RETURNING *
          `,
          [
            asaasSubscriptionId || null,
            dataProximaCobranca || null,

            asaasSubscriptionId
              ? "Assinatura mensal ativa no Asaas."
              : assinatura.observacoes,

            assinatura.id
          ]
        );

      await client.query(
        `
        UPDATE negocios
        SET plano_id = $1
        WHERE id = $2
        `,
        [
          assinatura.plano_id,
          assinatura.negocio_id
        ]
      );

      return ativacao.rows[0] || null;
    }
  );
}

async function buscarMinhaAssinatura({
  usuarioId
}) {
  if (!usuarioId) {
    throw new Error(
      "Usuário não autenticado."
    );
  }

  const negocio =
    await assinaturaRepository.buscarNegocioDono(
      usuarioId
    );

  if (!negocio) {
    throw new Error(
      "Negócio não encontrado."
    );
  }

  const assinatura =
    await assinaturaRepository
      .buscarUltimaAssinaturaPorNegocio(
        negocio.id
      );

  const plano =
    await assinaturaRepository.buscarPlano(
      negocio.plano_id
    );

  const pagamentos =
    await assinaturaRepository.listarPagamentos(
      assinatura?.id || 0
    );

  const uso =
    await buscarUsoPlano(negocio.id);

  return {
    plano,
    assinatura,

    uso: {
      utilizados:
        uso?.utilizados || 0,

      limite:
        uso?.capacidade_agendamentos ?? null,

      restantes:
        uso?.restantes ?? null,

      percentual:
        uso?.percentual ?? null,

      profissionais_utilizados:
        uso?.profissionais_utilizados || 0,

      limite_profissionais:
        uso?.limite_profissionais ?? null,

      servicos_utilizados:
        uso?.servicos_utilizados || 0,

      limite_servicos:
        uso?.limite_servicos ?? null
    },

    pagamentos
  };
}

module.exports = {
  registrarAssinaturaPendente,
  registrarPagamento,
  ativarAssinaturaPorPagamento,
  buscarMinhaAssinatura
};