const crypto = require("crypto");
const db = require("../db/db");

const checkoutRepository = require("../repositories/checkoutRepository");
const checkoutTentativaRepository = require(
  "../repositories/checkoutTentativaRepository"
);
const assinaturaRepository = require(
  "../repositories/assinaturaRepository"
);
const AppError = require("../errors/AppError");

const {
  criarClienteAsaas,
  criarAssinaturaAsaas,
  criarCobrancaPix,
  buscarQrCodePix,
  buscarPagamentoAsaas
} = require("./asaasService");

const {
  registrarAssinaturaPendente,
  registrarPagamento,
  ativarAssinaturaPorPagamento
} = require("./assinaturaService");

function normalizarDocumento(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function obterDocumentoCliente(documentoInformado) {
  const documento = normalizarDocumento(
    documentoInformado ||
    process.env.ASAAS_SANDBOX_CUSTOMER_CPF
  );

  if (![11, 14].includes(documento.length)) {
    throw new Error(
      "Informe um CPF/CNPJ vÃ¡lido para gerar a cobranÃ§a."
    );
  }

  return documento;
}

async function buscarDadosClienteAsaas(client, negocioId, usuarioId) {
  const result = await client.query(
    `
    SELECT
      n.nome AS nome_negocio,
      n.whatsapp AS telefone_negocio,
      u.nome AS nome_dono,
      u.email AS email_dono,
      u.whatsapp AS telefone_dono
    FROM negocios n
    INNER JOIN usuarios_negocios un
      ON un.negocio_id = n.id
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    WHERE n.id = $1
      AND un.usuario_id = $2
      AND un.papel = 'dono'
      AND un.ativo = TRUE
    LIMIT 1
    `,
    [negocioId, usuarioId]
  );

  return result.rows[0] || null;
}

async function garantirClienteAsaas({
  client,
  negocio,
  usuarioId,
  cpfCnpj
}) {
  if (negocio.asaas_customer_id) {
    return negocio;
  }

  const dadosCliente = await buscarDadosClienteAsaas(
    client,
    negocio.id,
    usuarioId
  );

  if (!dadosCliente) {
    throw new Error(
      "NÃ£o foi possÃ­vel carregar os dados do responsÃ¡vel pelo negÃ³cio."
    );
  }

  const clienteAsaas = await criarClienteAsaas({
    nome:
      dadosCliente.nome_negocio ||
      dadosCliente.nome_dono,
    email: dadosCliente.email_dono,
    telefone:
      dadosCliente.telefone_negocio ||
      dadosCliente.telefone_dono,
    cpfCnpj: obterDocumentoCliente(cpfCnpj),
    externalReference: `negocio:${negocio.id}`,
    reutilizarPorExternalReference: true
  });

  if (!clienteAsaas?.id) {
    throw new Error(
      "O Asaas nÃ£o retornou o identificador do cliente."
    );
  }

  const atualizacao = await client.query(
    `
    UPDATE negocios
    SET asaas_customer_id = $1
    WHERE id = $2
      AND asaas_customer_id IS NULL
    RETURNING asaas_customer_id
    `,
    [clienteAsaas.id, negocio.id]
  );

  if (atualizacao.rows[0]?.asaas_customer_id) {
    negocio.asaas_customer_id =
      atualizacao.rows[0].asaas_customer_id;

    return negocio;
  }

  const consulta = await client.query(
    `
    SELECT asaas_customer_id
    FROM negocios
    WHERE id = $1
    LIMIT 1
    `,
    [negocio.id]
  );

  negocio.asaas_customer_id =
    consulta.rows[0]?.asaas_customer_id;

  if (!negocio.asaas_customer_id) {
    throw new Error(
      "NÃ£o foi possÃ­vel salvar o cliente Asaas no negÃ³cio."
    );
  }

  return negocio;
}

async function obterAssinaturaCheckout({
  client,
  negocio,
  plano,
  formaPagamento,
  tentativa
}) {
  if (tentativa.assinatura_id) {
    const assinaturaExistente =
      await assinaturaRepository.buscarPorId(
        tentativa.assinatura_id
      );

    if (assinaturaExistente) {
      return assinaturaExistente;
    }
  }

  const assinatura =
    await registrarAssinaturaPendente(client, {
      negocio_id: negocio.id,
      plano_id: plano.id,
      asaas_customer_id: negocio.asaas_customer_id,
      asaas_subscription_id: null,
      status: "PENDING",
      forma_pagamento: formaPagamento,
      periodicidade: "MONTHLY",
      valor: plano.valor,
      observacoes:
        formaPagamento === "pix"
          ? "PIX inicial criado. Assinatura recorrente será ativada após confirmação do pagamento."
          : "Assinatura criada via cartão."
    });

  await checkoutTentativaRepository
    .vincularAssinatura(
      tentativa.id,
      assinatura.id
    );

  tentativa.assinatura_id = assinatura.id;

  return assinatura;
}

async function criarCheckoutPix(
  client,
  negocio,
  plano,
  tentativa
) {
  const assinaturaLocal =
    await obterAssinaturaCheckout({
      client,
      negocio,
      plano,
      formaPagamento: "pix",
      tentativa
    });

  const externalReference =
    `checkout:${tentativa.id};assinatura:${assinaturaLocal.id}`;

  const cobranca = await criarCobrancaPix({
    customerId: negocio.asaas_customer_id,
    valor: plano.valor,
    descricao: `Agenda Fashion - Plano ${plano.nome}`,
    externalReference,
    reutilizarPorExternalReference: true
  });

  const pix = await buscarQrCodePix(cobranca.id);

  await registrarPagamento(client, {
    assinatura_id: assinaturaLocal.id,
    asaas_payment_id: cobranca.id,
    valor: cobranca.value || plano.valor,
    forma_pagamento: "pix",
    status: cobranca.status || "PENDING",
    data_vencimento: cobranca.dueDate || null,
    pix_copia_cola: pix?.payload || null,
    pix_qrcode: pix?.encodedImage || null
  });

  return {
    assinatura: assinaturaLocal,
    pagamento: cobranca,
    pix
  };
}

async function criarCheckoutCartao(
  client,
  negocio,
  plano,
  cartao,
  tentativa
) {
  const assinaturaLocal =
    await obterAssinaturaCheckout({
      client,
      negocio,
      plano,
      formaPagamento: "cartao",
      tentativa
    });

  const assinaturaAsaas =
    await criarAssinaturaAsaas({
      customerId: negocio.asaas_customer_id,
      valor: plano.valor,
      descricao: `Agenda Fashion - Plano ${plano.nome}`,
      formaPagamento: "cartao",
      externalReference:
        `checkout:${tentativa.id};assinatura:${assinaturaLocal.id}`,
      cartao,
      reutilizarPorExternalReference: true
    });

  const atualizacao = await client.query(
    `
    UPDATE assinaturas
    SET
      asaas_subscription_id = $2,
      status = $3,
      data_proxima_cobranca = $4,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      assinaturaLocal.id,
      assinaturaAsaas.id,
      assinaturaAsaas.status || "PENDING",
      assinaturaAsaas.nextDueDate || null
    ]
  );

  return {
    assinatura:
      atualizacao.rows[0] || assinaturaLocal,
    assinatura_asaas: assinaturaAsaas
  };
}

function criarHashCheckout({
  negocioId,
  planoId,
  formaPagamento
}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        negocioId: Number(negocioId),
        planoId: Number(planoId),
        formaPagamento
      })
    )
    .digest("hex");
}

function validarChaveIdempotencia(chave) {
  const valor = String(chave || "").trim();

  if (
    valor.length < 16 ||
    valor.length > 120 ||
    !/^[A-Za-z0-9._:-]+$/.test(valor)
  ) {
    throw new AppError(
      "Chave de idempotência do checkout inválida.",
      400
    );
  }

  return valor;
}

async function criarCheckout({
  usuarioId,
  planoId,
  formaPagamento,
  cartao,
  cpfCnpj,
  chaveIdempotencia
}) {
  const client = db;

  if (!usuarioId) {
    throw new Error("UsuÃ¡rio nÃ£o autenticado.");
  }

  if (!planoId || !["pix", "cartao"].includes(formaPagamento)) {
    throw new Error("Dados de checkout invÃ¡lidos.");
  }

  if (formaPagamento === "cartao" && !cartao) {
    throw new Error("Dados do cartÃ£o nÃ£o informados.");
  }

  const chave =
    validarChaveIdempotencia(
      chaveIdempotencia
    );

  const negocio =
    await checkoutRepository.buscarNegocioDono(
      client,
      usuarioId
    );

  if (!negocio) {
    throw new Error("NegÃ³cio nÃ£o encontrado.");
  }

  const plano =
    await checkoutRepository.buscarPlano(
      client,
      planoId
    );

  if (!plano) {
    throw new Error("Plano nÃ£o encontrado.");
  }

  if (Number(plano.valor || 0) <= 0) {
    throw new Error("Este plano nÃ£o precisa de pagamento.");
  }

  let tentativa;

  try {
    tentativa =
      await checkoutTentativaRepository.iniciar({
        negocioId: negocio.id,
        chaveIdempotencia: chave,
        requestHash: criarHashCheckout({
          negocioId: negocio.id,
          planoId: plano.id,
          formaPagamento
        })
      });
  } catch (erro) {
    if (
      erro?.code ===
      "IDEMPOTENCY_KEY_REUSED"
    ) {
      throw new AppError(
        erro.message,
        409
      );
    }

    throw erro;
  }

  if (!tentativa.executar) {
    if (
      tentativa.tentativa.status ===
      "COMPLETED"
    ) {
      return tentativa.tentativa.resposta;
    }

    throw new AppError(
      "Este checkout já está sendo processado. Aguarde alguns segundos.",
      409
    );
  }

  try {
    await garantirClienteAsaas({
      client,
      negocio,
      usuarioId,
      cpfCnpj:
        cpfCnpj ||
        cartao?.cpfCnpj
    });

    let resultado = null;

    if (formaPagamento === "pix") {
      resultado = await criarCheckoutPix(
        client,
        negocio,
        plano,
        tentativa.tentativa
      );
    }

    if (formaPagamento === "cartao") {
      resultado = await criarCheckoutCartao(
        client,
        negocio,
        plano,
        cartao,
        tentativa.tentativa
      );
    }

    const resposta = {
      mensagem:
        formaPagamento === "pix"
          ? "PIX gerado com sucesso."
          : "Assinatura enviada para processamento.",
      forma_pagamento: formaPagamento,
      ...resultado
    };

    await checkoutTentativaRepository
      .concluir(
        tentativa.tentativa.id,
        resposta
      );

    return resposta;
  } catch (erro) {
    await checkoutTentativaRepository
      .marcarFalha(
        tentativa.tentativa.id,
        erro?.message
      )
      .catch(() => {});

    throw erro;
  }
}

async function consultarStatusCheckout({
  usuarioId,
  pagamentoId
}) {
  if (!usuarioId) {
    throw new Error("UsuÃ¡rio nÃ£o autenticado.");
  }

  if (!pagamentoId) {
    throw new Error("Pagamento nÃ£o informado.");
  }

  let pagamentoAsaas = null;

  try {
    pagamentoAsaas = await buscarPagamentoAsaas(pagamentoId);
  } catch (erroAsaas) {
    console.error(
      "Erro ao consultar pagamento no Asaas:",
      erroAsaas.response?.data || erroAsaas
    );
  }

  if (
    pagamentoAsaas &&
    ["CONFIRMED", "RECEIVED"].includes(pagamentoAsaas.status)
  ) {
    await ativarAssinaturaPorPagamento(
      pagamentoId,
      pagamentoAsaas.status
    );
  }

  const pagamento =
    await checkoutRepository.buscarPagamentoCheckout(
      pagamentoId,
      usuarioId
    );

  if (!pagamento) {
    throw new Error("Pagamento nÃ£o encontrado.");
  }

  return pagamento;
}

module.exports = {
  criarCheckout,
  consultarStatusCheckout
};
