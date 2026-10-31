const crypto = require("crypto");
const db = require("../db/db");
const renovacaoRepository = require("../repositories/assinaturaRenovacaoRepository");
const { valoresMonetariosIguais } = require("./assinaturaCalculos");

const checkoutRepository = require("../repositories/checkoutRepository");
const checkoutTentativaRepository = require(
  "../repositories/checkoutTentativaRepository"
);
const assinaturaRepository = require(
  "../repositories/assinaturaRepository"
);
const AppError = require("../errors/AppError");
const {
  documentoValido,
  normalizarDocumento
} = require("../utils/documento");

const {
  criarClienteAsaas,
  criarCobrancaPix,
  buscarQrCodePix
} = require("./asaasService");

const {
  registrarAssinaturaPendente,
  registrarPagamento
} = require("./assinaturaService");

function obterDocumentoCliente(documentoInformado) {
  const ambienteSandbox =
    String(process.env.ASAAS_API_URL || "")
      .toLowerCase()
      .includes("sandbox");

  const documento = normalizarDocumento(
    documentoInformado ||
    (
      ambienteSandbox
        ? process.env.ASAAS_SANDBOX_CUSTOMER_CPF
        : ""
    )
  );

  if (!documentoValido(documento)) {
    throw new AppError(
      "Informe um CPF/CNPJ válido para gerar a cobrança.",
      400
    );
  }

  return documento;
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

  const dadosCliente = await checkoutRepository
    .buscarDadosClienteAsaas(
      client,
      negocio.id,
      usuarioId
    );

  if (!dadosCliente) {
    throw new Error(
      "Não foi possível carregar os dados do responsável pelo negócio."
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
      "O Asaas não retornou o identificador do cliente."
    );
  }

  negocio.asaas_customer_id =
    await checkoutRepository
      .salvarClienteAsaasSeAusente(
        client,
        negocio.id,
        clienteAsaas.id
      );

  if (!negocio.asaas_customer_id) {
    throw new Error(
      "Não foi possível salvar o cliente Asaas no negócio."
    );
  }

  return negocio;
}

async function obterAssinaturaCheckout({
  client,
  negocio,
  plano,
  formaPagamento,
  tentativa,
  usuarioId
}) {
  const assinatura = await db.executarTransacao(
    async (transactionClient) => {
      // Conta antes do negócio: mudanças concorrentes de acesso não podem
      // validar uma dona desativada entre consulta e persistência do checkout.
      const contaAtiva = await checkoutRepository.bloquearContaDonoCheckout(
        transactionClient,
        usuarioId
      );
      if (!contaAtiva) {
        throw new AppError("A conta não está mais ativa para este checkout.", 409);
      }

      await checkoutRepository
        .bloquearCheckoutDoNegocio(
          transactionClient,
          negocio.id
        );

      const elegivel = await checkoutRepository.buscarElegibilidadeCheckout(
        transactionClient,
        negocio.id,
        usuarioId
      );
      if (!elegivel || elegivel.publicado !== true) {
        throw new AppError(
          "A proprietária precisa manter um negócio ativo e publicado para gerar PIX.",
          409
        );
      }
      const vigente = await checkoutRepository.buscarAssinaturaVigenteDoNegocio(
        transactionClient,
        negocio.id
      );
      if (Number(vigente?.plano_id) === Number(plano.id)) {
        throw new AppError("Este já é o plano pago vigente do seu negócio.", 409);
      }

      const planoAtual = await checkoutRepository.buscarPlano(
        transactionClient,
        plano.id
      );
      if (!planoAtual || (!tentativa.assinatura_id &&
        !valoresMonetariosIguais(planoAtual.valor, plano.valor))) {
        throw new AppError("O preço ou a disponibilidade do plano mudou. Atualize os planos antes de pagar.", 409);
      }

      if (tentativa.assinatura_id) {
        const existente = await assinaturaRepository.buscarPorId(
          tentativa.assinatura_id,
          transactionClient
        );
        if (existente) {
          if (Number(existente.negocio_id) !== Number(negocio.id) ||
              Number(existente.plano_id) !== Number(plano.id)) {
            throw new AppError("A tentativa não pertence ao plano e negócio informados.", 409);
          }
          return existente;
        }
      }

      if (await renovacaoRepository.possuiPendente(negocio.id, transactionClient)) {
        throw new AppError("Aguarde a conferência da renovação antes de gerar outro PIX.", 409);
      }

      const pendente = await checkoutRepository
        .buscarAssinaturaPendenteDoNegocio(
          transactionClient,
          negocio.id
        );

      if (pendente) {
        throw new AppError(
          pendente.plano_nome
            ? `Já existe um PIX pendente para o plano ${pendente.plano_nome}. Conclua ou aguarde o vencimento antes de gerar outra cobrança.`
            : "Já existe um PIX pendente para este negócio. Conclua ou aguarde o vencimento antes de gerar outra cobrança.",
          409
        );
      }

      const novaAssinatura =
        await registrarAssinaturaPendente(
          transactionClient,
          {
            negocio_id: negocio.id,
            plano_id: plano.id,
            asaas_customer_id:
              negocio.asaas_customer_id,
            asaas_subscription_id: null,
            status: "PENDING",
            forma_pagamento:
              formaPagamento,
            periodicidade: "MONTHLY",
            valor: plano.valor,
            observacoes:
              "PIX inicial criado. Assinatura recorrente será ativada após confirmação do pagamento."
          }
        );

      const vinculada =
        await checkoutTentativaRepository
          .vincularAssinatura(
            tentativa.id,
            novaAssinatura.id,
            tentativa.lease_tentativa,
            transactionClient
          );

      if (!vinculada) {
        throw new AppError(
          "Esta tentativa de checkout foi assumida por outra execução. Gere ou consulte o PIX novamente.",
          409
        );
      }

      return novaAssinatura;
    }
  );

  tentativa.assinatura_id = assinatura.id;

  return assinatura;
}

async function criarCheckoutPix(
  client,
  negocio,
  plano,
  tentativa,
  usuarioId
) {
  const assinaturaLocal =
    await obterAssinaturaCheckout({
      client,
      negocio,
      plano,
      formaPagamento: "pix",
      tentativa,
      usuarioId
    });

  const externalReference =
    `checkout:${tentativa.id};assinatura:${assinaturaLocal.id}`;

  const valorContratado = assinaturaLocal.valor ?? plano.valor;
  const cobranca = await criarCobrancaPix({
    customerId: negocio.asaas_customer_id,
    valor: valorContratado,
    descricao: `Agenda Fashion - Plano ${plano.nome}`,
    externalReference,
    reutilizarPorExternalReference: true
  });

  if (!cobranca?.id) {
    throw new Error(
      "O Asaas não retornou o identificador da cobrança PIX."
    );
  }

  if (!valoresMonetariosIguais(cobranca.value, valorContratado) ||
      (cobranca.externalReference && cobranca.externalReference !== externalReference) ||
      (cobranca.customer && cobranca.customer !== negocio.asaas_customer_id) ||
      (cobranca.billingType && String(cobranca.billingType).toUpperCase() !== "PIX")) {
    throw new AppError(
      "A cobrança retornada não corresponde ao contrato. Nenhum novo pagamento será liberado até a conferência.",
      409
    );
  }

  /*
   * Persiste a cobrança antes de consultar o QR Code.
   * O Asaas pode levar alguns segundos para disponibilizá-lo;
   * assim, mesmo se essa consulta falhar, o pagamento não fica
   * órfão no banco e pode ser recuperado pela idempotência.
   */
  await registrarPagamento(client, {
    assinatura_id: assinaturaLocal.id,
    asaas_payment_id: cobranca.id,
    valor: valorContratado,
    forma_pagamento: "pix",
    status: cobranca.status || "PENDING",
    data_vencimento: cobranca.dueDate || null,
    invoice_url: cobranca.invoiceUrl || null,
    pix_copia_cola: null,
    pix_qrcode: null
  });

  const pix = await buscarQrCodePix(cobranca.id);

  await registrarPagamento(client, {
    assinatura_id: assinaturaLocal.id,
    asaas_payment_id: cobranca.id,
    valor: valorContratado,
    forma_pagamento: "pix",
    status: cobranca.status || "PENDING",
    data_vencimento: cobranca.dueDate || null,
    invoice_url: cobranca.invoiceUrl || null,
    pix_copia_cola: pix?.payload || null,
    pix_qrcode: pix?.encodedImage || null
  });

  return {
    assinatura: assinaturaLocal,
    pagamento: cobranca,
    pix
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
  cpfCnpj,
  chaveIdempotencia
}) {
  const client = db;

  if (!usuarioId) {
    throw new AppError("Usuário não autenticado.", 401);
  }

  if (!planoId || formaPagamento !== "pix") {
    throw new AppError(
      "Aceitamos pagamento somente por PIX.",
      400
    );
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
    throw new AppError("Negócio não encontrado.", 404);
  }

  if (negocio.publicado !== true) {
    throw new AppError(
      "Publique seu negócio antes de iniciar um checkout pago.",
      409
    );
  }

  if (await renovacaoRepository.possuiPendente(negocio.id)) {
    throw new AppError("Aguarde a conferência da renovação antes de gerar outro PIX.", 409);
  }

  const plano =
    await checkoutRepository.buscarPlano(
      client,
      planoId
    );

  if (!plano) {
    throw new AppError("Plano não encontrado.", 404);
  }

  if (Number(plano.valor || 0) <= 0) {
    throw new AppError("Este plano não precisa de pagamento.", 400);
  }

  const assinaturaVigente = await checkoutRepository.buscarAssinaturaVigenteDoNegocio(
    client,
    negocio.id
  );
  if (Number(assinaturaVigente?.plano_id) === Number(plano.id)) {
    throw new AppError(
      "Este já é o plano pago vigente do seu negócio.",
      409
    );
  }

  const documentoCliente =
    !negocio.asaas_customer_id
      ? obterDocumentoCliente(
          cpfCnpj
        )
      : null;

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
        documentoCliente
    });

    const resultado = await criarCheckoutPix(
      client,
      negocio,
      plano,
      tentativa.tentativa,
      usuarioId
    );

    const resposta = {
      mensagem: "PIX gerado com sucesso.",
      forma_pagamento: "pix",
      ...resultado
    };

    const concluida =
      await checkoutTentativaRepository
        .concluir(
          tentativa.tentativa.id,
          resposta,
          tentativa.tentativa.lease_tentativa
        );

    if (!concluida) {
      throw new AppError(
        "Esta tentativa de checkout foi assumida por outra execução. Consulte novamente o status do pagamento.",
        409
      );
    }

    return resposta;
  } catch (erro) {
    await checkoutTentativaRepository
      .marcarFalha(
        tentativa.tentativa.id,
        erro?.message,
        tentativa.tentativa.lease_tentativa
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
    throw new AppError("Usuário não autenticado.", 401);
  }

  if (!pagamentoId) {
    throw new AppError("Pagamento não informado.", 400);
  }

  const pagamento =
    await checkoutRepository.buscarPagamentoCheckout(
      pagamentoId,
      usuarioId
    );

  if (!pagamento) {
    throw new AppError("Pagamento não encontrado.", 404);
  }

  const statusPagamento = String(
    pagamento.status || ""
  )
    .trim()
    .toUpperCase();
  const statusAssinatura = String(
    pagamento.status_assinatura || ""
  )
    .trim()
    .toUpperCase();
  const pagamentoConfirmado = [
    "CONFIRMED",
    "RECEIVED",
    "RECEIVED_IN_CASH"
  ].includes(statusPagamento);
  const assinaturaAtiva =
    pagamento.ativo === true &&
    statusAssinatura === "ACTIVE";

  if (assinaturaAtiva) {
    return {
      ...pagamento,
      estado_ativacao: "ATIVO"
    };
  }

  if (!pagamentoConfirmado) {
    return {
      ...pagamento,
      estado_ativacao:
        "AGUARDANDO_PAGAMENTO"
    };
  }

  const processamento =
    await checkoutRepository
      .buscarEstadoAtivacaoPagamento(
        pagamentoId
      );

  return {
    ...pagamento,
    estado_ativacao:
      processamento?.falha_terminal === true
        ? "ATIVACAO_REQUER_ATENCAO"
        : "PAGAMENTO_CONFIRMADO_ATIVANDO"
  };
}

module.exports = {
  criarCheckout,
  consultarStatusCheckout
};
