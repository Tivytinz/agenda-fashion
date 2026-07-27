const db = require("../db/db");

const assinaturaRepository = require("../repositories/assinaturaRepository");
const pagamentoRepository = require("../repositories/pagamentoRepository");
const {
  criarAssinaturaAsaas,
  listarPagamentosAssinatura,
  removerAssinaturaAsaas
} = require("./asaasService");
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

      if (
        [
          "CANCELED",
          "CANCELLED"
        ].includes(
          String(
            assinatura.status || ""
          )
            .trim()
            .toUpperCase()
        )
      ) {
        return assinatura;
      }

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

  await assinaturaRepository
    .expirarCancelamentoSeNecessario(
      negocio.id
    );

  const negocioAtualizado =
    await assinaturaRepository.buscarNegocioDono(
      usuarioId
    );

  const assinatura =
    await assinaturaRepository
      .buscarUltimaAssinaturaPorNegocio(
        negocio.id
      );

  const plano =
    await assinaturaRepository.buscarPlano(
      negocioAtualizado?.plano_id ||
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

function criarErro(
  mensagem,
  status = 400
) {
  const erro =
    new Error(mensagem);

  erro.status = status;
  erro.statusCode = status;

  return erro;
}

function obterPagamentosDaResposta(
  resposta
) {
  if (
    Array.isArray(resposta)
  ) {
    return resposta;
  }

  if (
    Array.isArray(
      resposta?.data
    )
  ) {
    return resposta.data;
  }

  return [];
}

function dataValida(
  valor
) {
  const texto =
    String(valor || "")
      .slice(0, 10);

  return /^\d{4}-\d{2}-\d{2}$/
    .test(texto)
      ? texto
      : null;
}

async function calcularFimDoPeriodoPago(
  assinatura
) {
  let pagamentosAsaas = null;

  try {
    pagamentosAsaas =
      await listarPagamentosAssinatura(
        assinatura.asaas_subscription_id
      );
  } catch (erro) {
    /*
     * Pode ocorrer em uma repetição após
     * o Asaas ter removido a assinatura,
     * mas antes da atualização local.
     */
    if (
      erro?.response?.status !== 404
    ) {
      throw erro;
    }
  }

  const cobrancasAbertas =
    obterPagamentosDaResposta(
      pagamentosAsaas
    )
      .filter(
        (pagamento) => {
          const status =
            String(
              pagamento?.status || ""
            )
              .trim()
              .toUpperCase();

          return ![
            "CONFIRMED",
            "RECEIVED",
            "RECEIVED_IN_CASH",
            "REFUNDED",
            "DELETED"
          ].includes(status) &&
            dataValida(
              pagamento?.dueDate
            );
        }
      )
      .sort(
        (a, b) =>
          String(a.dueDate)
            .localeCompare(
              String(b.dueDate)
            )
      );

  const primeiraCobrancaAberta =
    dataValida(
      cobrancasAbertas[0]
        ?.dueDate
    );

  if (primeiraCobrancaAberta) {
    return primeiraCobrancaAberta;
  }

  const pagamentosLocais =
    await assinaturaRepository
      .listarPagamentos(
        assinatura.id
      );

  const ultimoPagamentoRecebido =
    pagamentosLocais.find(
      (pagamento) =>
        [
          "CONFIRMED",
          "RECEIVED",
          "RECEIVED_IN_CASH"
        ].includes(
          String(
            pagamento?.status || ""
          )
            .trim()
            .toUpperCase()
        )
    );

  if (ultimoPagamentoRecebido) {
    return calcularProximaCobranca(
      ultimoPagamentoRecebido
        .data_pagamento ||
      ultimoPagamentoRecebido
        .data_vencimento
    );
  }

  const dataLocal =
    dataValida(
      assinatura
        .data_proxima_cobranca
    );

  if (dataLocal) {
    return dataLocal;
  }

  throw criarErro(
    "Não foi possível identificar até quando o plano já está pago.",
    409
  );
}

async function cancelarMinhaAssinatura({
  usuarioId
}) {
  if (!usuarioId) {
    throw criarErro(
      "Usuário não autenticado.",
      401
    );
  }

  const negocio =
    await assinaturaRepository.buscarNegocioDono(
      usuarioId
    );

  if (!negocio) {
    throw criarErro(
      "Negócio não encontrado.",
      404
    );
  }

  const assinatura =
    await assinaturaRepository
      .buscarAssinaturaAtivaPorNegocio(
        negocio.id
      );

  if (!assinatura) {
    throw criarErro(
      "Nenhuma assinatura ativa foi encontrada.",
      404
    );
  }

  const status =
    String(
      assinatura.status || ""
    )
      .trim()
      .toUpperCase();

  if (
    [
      "CANCELED",
      "CANCELLED"
    ].includes(status)
  ) {
    return {
      mensagem:
        "A renovação desta assinatura já está cancelada.",
      assinatura,
      acesso_ate:
        assinatura.data_proxima_cobranca
    };
  }

  if (status !== "ACTIVE") {
    throw criarErro(
      "Somente uma assinatura ativa pode ter a renovação cancelada.",
      409
    );
  }

  if (
    !assinatura
      .asaas_subscription_id
  ) {
    throw criarErro(
      "A assinatura não possui uma recorrência vinculada no Asaas.",
      409
    );
  }

  const acessoAte =
    await calcularFimDoPeriodoPago(
      assinatura
    );

  await removerAssinaturaAsaas(
    assinatura.asaas_subscription_id
  );

  const observacoes =
    "Renovação cancelada pelo titular. " +
    `Acesso mantido até ${
      acessoAte
    }.`;

  const assinaturaCancelada =
    await db.executarTransacao(
      async (client) => {
        return assinaturaRepository
          .registrarCancelamento(
            client,
            {
              assinaturaId:
                assinatura.id,

              negocioId:
                negocio.id,

              acessoAte,

              observacoes
            }
          );
      }
    );

  if (!assinaturaCancelada) {
    throw criarErro(
      "A recorrência foi encerrada, mas não foi possível atualizar a assinatura local. Tente novamente para sincronizar.",
      409
    );
  }

  return {
    mensagem:
      "Renovação cancelada com sucesso. " +
      "O plano continuará disponível até o fim do período já pago.",

    assinatura:
      assinaturaCancelada,

    acesso_ate:
      assinaturaCancelada
        .data_proxima_cobranca
  };
}

module.exports = {
  registrarAssinaturaPendente,
  registrarPagamento,
  ativarAssinaturaPorPagamento,
  buscarMinhaAssinatura,
  cancelarMinhaAssinatura
};
