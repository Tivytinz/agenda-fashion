const db = require("../db/db");

const assinaturaRepository = require("../repositories/assinaturaRepository");
const pagamentoRepository = require("../repositories/pagamentoRepository");
const {
  criarAssinaturaAsaas,
  removerAssinaturaAsaas
} = require("./asaasService");
const { buscarUsoPlano } = require("./planoService");

async function registrarAssinaturaPendente(client, dados) {
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

function normalizarFormaPagamento(
  billingType
) {
  const tipo =
    String(billingType || "")
      .trim()
      .toUpperCase();

  const formas = {
    PIX: "pix",
    CREDIT_CARD: "cartao",
    BOLETO: "boleto"
  };

  return formas[tipo] || null;
}

function extrairReferenciaAssinatura(
  externalReference
) {
  const referencia =
    String(externalReference || "");

  const valores = {};

  for (const trecho of referencia.split(";")) {
    const [chave, valor] =
      trecho.split(":");

    if (
      ["assinatura", "negocio", "plano"]
        .includes(chave) &&
      /^\d+$/.test(valor || "")
    ) {
      valores[chave] = Number(valor);
    }
  }

  return valores;
}

async function localizarAssinaturaPorWebhook(
  client,
  subscriptionId,
  externalReference
) {
  const porSubscription =
    await client.query(
      `
      SELECT *
      FROM assinaturas
      WHERE asaas_subscription_id = $1
      LIMIT 1
      FOR UPDATE
      `,
      [subscriptionId]
    );

  if (porSubscription.rows[0]) {
    return porSubscription.rows[0];
  }

  const referencia =
    extrairReferenciaAssinatura(
      externalReference
    );

  if (!referencia.assinatura) {
    return null;
  }

  const porReferencia =
    await client.query(
      `
      SELECT *
      FROM assinaturas
      WHERE id = $1
        AND (
          asaas_subscription_id IS NULL
          OR asaas_subscription_id = $2
        )
      LIMIT 1
      FOR UPDATE
      `,
      [
        referencia.assinatura,
        subscriptionId
      ]
    );

  const assinatura =
    porReferencia.rows[0] || null;

  if (
    !assinatura ||
    (
      referencia.negocio &&
      referencia.negocio !==
        assinatura.negocio_id
    ) ||
    (
      referencia.plano &&
      referencia.plano !==
        assinatura.plano_id
    )
  ) {
    return null;
  }

  return assinatura;
}

function acessoPagoAindaValido(
  assinatura
) {
  const acessoAte =
    String(
      assinatura
        ?.data_proxima_cobranca ||
      ""
    ).slice(0, 10);

  const hoje =
    new Date()
      .toISOString()
      .slice(0, 10);

  return (
    assinatura?.ativo === true &&
    /^\d{4}-\d{2}-\d{2}$/
      .test(acessoAte) &&
    acessoAte > hoje
  );
}

async function sincronizarAssinaturaPorWebhook(
  tipoEvento,
  dadosAssinatura = {}
) {
  const subscriptionId =
    String(
      dadosAssinatura.id || ""
    ).trim();

  if (!subscriptionId) {
    throw new Error(
      "Assinatura não informada."
    );
  }

  const eventos =
    new Set([
      "SUBSCRIPTION_CREATED",
      "SUBSCRIPTION_UPDATED",
      "SUBSCRIPTION_INACTIVATED",
      "SUBSCRIPTION_DELETED"
    ]);

  if (!eventos.has(tipoEvento)) {
    return null;
  }

  return db.executarTransacao(
    async (client) => {
      const assinatura =
        await localizarAssinaturaPorWebhook(
          client,
          subscriptionId,
          dadosAssinatura
            .externalReference
        );

      if (!assinatura) {
        return null;
      }

      const eventoEncerramento =
        [
          "SUBSCRIPTION_INACTIVATED",
          "SUBSCRIPTION_DELETED"
        ].includes(tipoEvento);

      const manterPeriodoPago =
        tipoEvento ===
          "SUBSCRIPTION_DELETED" &&
        acessoPagoAindaValido(
          assinatura
        );

      let status =
        assinatura.status;

      if (manterPeriodoPago) {
        status = "CANCELED";
      } else if (
        eventoEncerramento &&
        !manterPeriodoPago
      ) {
        status =
          tipoEvento ===
            "SUBSCRIPTION_DELETED"
            ? "DELETED"
            : "INACTIVE";
      } else if (
        assinatura.ativo === true &&
        ![
          "CANCELED",
          "CANCELLED"
        ].includes(
          String(
            assinatura.status || ""
          )
            .trim()
            .toUpperCase()
        ) &&
        dadosAssinatura.status
      ) {
        status =
          String(
            dadosAssinatura.status
          )
            .trim()
            .toUpperCase();
      }

      const ativo =
        eventoEncerramento &&
        !manterPeriodoPago
          ? false
          : assinatura.ativo;

      const atualizacao =
        await client.query(
          `
          UPDATE assinaturas
          SET
            asaas_subscription_id = $1,
            asaas_customer_id =
              COALESCE($2, asaas_customer_id),
            status = $3,
            forma_pagamento =
              COALESCE($4, forma_pagamento),
            periodicidade =
              COALESCE($5, periodicidade),
            valor =
              COALESCE($6, valor),
            data_proxima_cobranca =
              COALESCE(
                $7,
                data_proxima_cobranca
              ),
            ativo = $8,
            updated_at = NOW()
          WHERE id = $9
          RETURNING *
          `,
          [
            subscriptionId,
            dadosAssinatura.customer ||
              null,
            status,
            normalizarFormaPagamento(
              dadosAssinatura.billingType
            ),
            dadosAssinatura.cycle ||
              null,
            dadosAssinatura.value ??
              null,
            dadosAssinatura.nextDueDate ||
              null,
            ativo,
            assinatura.id
          ]
        );

      if (
        eventoEncerramento &&
        !manterPeriodoPago
      ) {
        const planoGratis =
          await client.query(
            `
            SELECT id
            FROM planos
            WHERE slug = 'inicial'
              AND ativo = TRUE
            LIMIT 1
            `
          );

        const planoGratisId =
          planoGratis.rows[0]?.id;

        if (!planoGratisId) {
          throw new Error(
            "Plano gratuito não encontrado para encerrar a assinatura."
          );
        }

        await client.query(
          `
          UPDATE negocios n
          SET plano_id = $1
          WHERE n.id = $2
            AND n.plano_id = $3
            AND NOT EXISTS (
              SELECT 1
              FROM assinaturas atual
              WHERE atual.negocio_id =
                n.id
                AND atual.id <> $4
                AND atual.ativo = TRUE
            )
          `,
          [
            planoGratisId,
            assinatura.negocio_id,
            assinatura.plano_id,
            assinatura.id
          ]
        );
      }

      return atualizacao.rows[0] ||
        null;
    }
  );
}

async function localizarAssinaturaPagamento(
  client,
  paymentId
) {
  const resultado =
    await client.query(
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

  return resultado.rows[0] || null;
}

async function garantirPagamentoRecorrente(
  client,
  paymentId,
  dadosPagamento = {}
) {
  let assinatura =
    await localizarAssinaturaPagamento(
      client,
      paymentId
    );

  if (assinatura) {
    return assinatura;
  }

  const subscriptionId =
    String(
      dadosPagamento.subscription ||
      ""
    ).trim();

  if (!subscriptionId) {
    return null;
  }

  const assinaturaResultado =
    await client.query(
      `
      SELECT *
      FROM assinaturas
      WHERE asaas_subscription_id = $1
      LIMIT 1
      FOR UPDATE
      `,
      [subscriptionId]
    );

  const assinaturaRecorrente =
    assinaturaResultado.rows[0] ||
    null;

  if (!assinaturaRecorrente) {
    return null;
  }

  await pagamentoRepository
    .criarPagamento(
      client,
      {
        assinatura_id:
          assinaturaRecorrente.id,
        asaas_payment_id:
          paymentId,
        valor:
          dadosPagamento.value ??
          assinaturaRecorrente.valor,
        forma_pagamento:
          normalizarFormaPagamento(
            dadosPagamento.billingType
          ) ||
          assinaturaRecorrente
            .forma_pagamento,
        status:
          dadosPagamento.status ||
          "PENDING",
        data_vencimento:
          dadosPagamento.dueDate ||
          null,
        data_pagamento:
          dadosPagamento.paymentDate ||
          dadosPagamento.confirmedDate ||
          null,
        pix_copia_cola: null,
        pix_qrcode: null
      }
    );

  assinatura =
    await localizarAssinaturaPagamento(
      client,
      paymentId
    );

  return assinatura;
}

async function sincronizarPagamentoPorWebhook(
  dadosPagamento = {}
) {
  const paymentId =
    String(
      dadosPagamento.id || ""
    ).trim();

  if (!paymentId) {
    throw new Error(
      "Pagamento não informado."
    );
  }

  return db.executarTransacao(
    async (client) => {
      const assinatura =
        await garantirPagamentoRecorrente(
          client,
          paymentId,
          dadosPagamento
        );

      if (!assinatura) {
        return null;
      }

      return pagamentoRepository
        .atualizarStatusPagamento(
          client,
          paymentId,
          {
            status:
              dadosPagamento.status ||
              "PENDING",
            data_pagamento:
              dadosPagamento.paymentDate ||
              dadosPagamento
                .confirmedDate ||
              null
          }
        );
    }
  );
}

async function suspenderAssinaturaPorPagamento(
  dadosPagamento = {}
) {
  const paymentId =
    String(
      dadosPagamento.id || ""
    ).trim();

  if (!paymentId) {
    throw new Error(
      "Pagamento não informado."
    );
  }

  return db.executarTransacao(
    async (client) => {
      const assinatura =
        await garantirPagamentoRecorrente(
          client,
          paymentId,
          dadosPagamento
        );

      if (!assinatura) {
        return null;
      }

      const status =
        String(
          dadosPagamento.status ||
          "OVERDUE"
        )
          .trim()
          .toUpperCase();

      await pagamentoRepository
        .atualizarStatusPagamento(
          client,
          paymentId,
          {
            status,
            data_pagamento: null
          }
        );

      const planoGratis =
        await client.query(
          `
          SELECT id
          FROM planos
          WHERE slug = 'inicial'
            AND ativo = TRUE
          LIMIT 1
          `
        );

      const planoGratisId =
        planoGratis.rows[0]?.id;

      if (!planoGratisId) {
        throw new Error(
          "Plano gratuito não encontrado para suspender a assinatura."
        );
      }

      const suspensao =
        await client.query(
          `
          UPDATE assinaturas
          SET
            status = $1,
            ativo = FALSE,
            observacoes = CONCAT_WS(
              E'\n',
              NULLIF(observacoes, ''),
              $2::text
            ),
            updated_at = NOW()
          WHERE id = $3
          RETURNING *
          `,
          [
            status,
            "Acesso suspenso automaticamente após evento financeiro do Asaas.",
            assinatura.id
          ]
        );

      await client.query(
        `
        UPDATE negocios n
        SET plano_id = $1
        WHERE n.id = $2
          AND n.plano_id = $3
          AND NOT EXISTS (
            SELECT 1
            FROM assinaturas atual
            WHERE atual.negocio_id = n.id
              AND atual.id <> $4
              AND atual.ativo = TRUE
          )
        `,
        [
          planoGratisId,
          assinatura.negocio_id,
          assinatura.plano_id,
          assinatura.id
        ]
      );

      return suspensao.rows[0] ||
        null;
    }
  );
}

async function ativarAssinaturaPorPagamento(
  paymentId,
  statusPagamento = "CONFIRMED",
  dadosPagamento = {}
) {
  if (!paymentId) {
    throw new Error("Pagamento não informado.");
  }

  return db.executarTransacao(
    async (client) => {
      const assinatura =
        await garantirPagamentoRecorrente(
          client,
          paymentId,
          {
            ...dadosPagamento,
            status:
              statusPagamento ||
              dadosPagamento.status
          }
        );

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

      let novaRecorrencia = false;

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
              dataProximaCobranca,

            reutilizarPorExternalReference:
              true
          });

        if (!assinaturaAsaas?.id) {
          throw new Error(
            "O Asaas não retornou o identificador da assinatura."
          );
        }

        asaasSubscriptionId =
          assinaturaAsaas.id;

        novaRecorrencia = true;

        dataProximaCobranca =
          assinaturaAsaas.nextDueDate ||
          dataProximaCobranca;
      } else if (
        assinatura.asaas_subscription_id &&
        (
          dadosPagamento.paymentDate ||
          dadosPagamento.confirmedDate ||
          dadosPagamento.dueDate
        )
      ) {
        dataProximaCobranca =
          calcularProximaCobranca(
            dadosPagamento.paymentDate ||
            dadosPagamento.confirmedDate ||
            dadosPagamento.dueDate
          );
      }

      /*
       * Na troca de plano, a nova recorrência é criada
       * antes de encerrarmos as anteriores. Se o DELETE
       * falhar, a ativação local é interrompida e o
       * webhook pode tentar novamente com segurança.
       */
      if (novaRecorrencia) {
        const anteriores =
          await client.query(
            `
            SELECT
              id,
              asaas_subscription_id
            FROM assinaturas
            WHERE negocio_id = $1
              AND id <> $2
              AND ativo = TRUE
            ORDER BY id ASC
            FOR UPDATE
            `,
            [
              assinatura.negocio_id,
              assinatura.id
            ]
          );

        const recorrencias =
          new Set(
            anteriores.rows
              .map(
                (item) =>
                  String(
                    item
                      .asaas_subscription_id ||
                    ""
                  ).trim()
              )
              .filter(
                (id) =>
                  id &&
                  id !==
                    asaasSubscriptionId
              )
          );

        for (
          const recorrenciaId
          of recorrencias
        ) {
          await removerAssinaturaAsaas(
            recorrenciaId
          );
        }

        await client.query(
          `
          UPDATE assinaturas
          SET
            ativo = FALSE,
            status = CASE
              WHEN asaas_subscription_id
                IS NOT NULL
                THEN 'CANCELED'
              ELSE status
            END,
            observacoes = CONCAT_WS(
              E'\n',
              NULLIF(observacoes, ''),
              'Recorrência substituída por uma nova assinatura.'
            ),
            updated_at = NOW()
          WHERE negocio_id = $1
            AND id <> $2
            AND ativo = TRUE
          `,
          [
            assinatura.negocio_id,
            assinatura.id
          ]
        );
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
  /*
   * Não consultamos o Asaas antes de cancelar.
   * Uma falha nessa consulta impediria que o DELETE
   * da assinatura fosse executado.
   *
   * Como a assinatura está ACTIVE, o pagamento inicial
   * já ativou o plano. Portanto, usamos os dados locais
   * para calcular o fim do período pago.
   */
  const pagamentosLocais =
    await assinaturaRepository.listarPagamentos(
      assinatura.id
    );

  const pagamentoRecebido =
    pagamentosLocais.find(
      (pagamento) =>
        [
          "CONFIRMED",
          "RECEIVED",
          "RECEIVED_IN_CASH"
        ].includes(
          String(pagamento?.status || "")
            .trim()
            .toUpperCase()
        )
    );

  const pagamentoComData =
    pagamentoRecebido ||
    pagamentosLocais.find(
      (pagamento) =>
        dataValida(pagamento?.data_pagamento) ||
        dataValida(pagamento?.data_vencimento)
    );

  if (pagamentoComData) {
    return calcularProximaCobranca(
      pagamentoComData.data_pagamento ||
      pagamentoComData.data_vencimento
    );
  }

  const dataLocal = dataValida(
    assinatura.data_proxima_cobranca
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

  const status = String(
    assinatura.status || ""
  )
    .trim()
    .toUpperCase();

  if (
    ["CANCELED", "CANCELLED"].includes(status)
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

  if (!assinatura.asaas_subscription_id) {
    throw criarErro(
      "A assinatura não possui uma recorrência vinculada no Asaas.",
      409
    );
  }

  const acessoAte =
    await calcularFimDoPeriodoPago(
      assinatura
    );

  /*
   * Agora a primeira chamada externa é diretamente
   * o DELETE da assinatura.
   */
  await removerAssinaturaAsaas(
    assinatura.asaas_subscription_id
  );

  const observacoes =
    "Renovação cancelada pelo titular. " +
    `Acesso mantido até ${acessoAte}.`;

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
  sincronizarAssinaturaPorWebhook,
  sincronizarPagamentoPorWebhook,
  suspenderAssinaturaPorPagamento,
  ativarAssinaturaPorPagamento,
  buscarMinhaAssinatura,
  cancelarMinhaAssinatura
};
