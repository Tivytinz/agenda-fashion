const axios = require("axios");
const {
  documentoValido,
  normalizarDocumento
} = require("../utils/documento");

const ASAAS_API_URL =
  String(
    process.env.ASAAS_API_URL || ""
  ).trim();

const ASAAS_API_KEY =
  String(
    process.env.ASAAS_API_KEY || ""
  ).trim();

function identificarAmbienteAsaas(url) {
  let endereco;

  try {
    endereco =
      new URL(
        String(url || "").trim()
      );
  } catch {
    return null;
  }

  if (endereco.protocol !== "https:") {
    return null;
  }

  if (
    endereco.hostname ===
    "api-sandbox.asaas.com"
  ) {
    return "sandbox";
  }

  if (
    endereco.hostname ===
    "api.asaas.com"
  ) {
    return "producao";
  }

  return null;
}

function validarConfigAsaas() {
  if (!ASAAS_API_URL || !ASAAS_API_KEY) {
    throw new Error(
      "Configuração do Asaas ausente."
    );
  }

  const ambiente =
    identificarAmbienteAsaas(
      ASAAS_API_URL
    );

  if (
    ambiente === "producao" &&
    !ASAAS_API_KEY.startsWith(
      "$aact_prod_"
    )
  ) {
    throw new Error(
      "Configuração inválida do Asaas: a URL de produção exige uma chave de produção."
    );
  }

  if (
    ambiente === "sandbox" &&
    !ASAAS_API_KEY.startsWith(
      "$aact_hmlg_"
    )
  ) {
    throw new Error(
      "Configuração inválida do Asaas: a URL de Sandbox exige uma chave de Sandbox."
    );
  }

  if (
    process.env.NODE_ENV ===
      "production" &&
    !ambiente
  ) {
    throw new Error(
      "Configuração inválida do Asaas: use um endpoint oficial em produção."
    );
  }

  return {
    ambiente,
    url: ASAAS_API_URL
  };
}

function obterTimeoutAsaas() {
  const configurado =
    Number(
      process.env
        .ASAAS_HTTP_TIMEOUT_MS
    );

  if (
    Number.isFinite(configurado) &&
    configurado >= 1000 &&
    configurado <= 30000
  ) {
    return configurado;
  }

  return 10000;
}

const asaasApi = axios.create({
  baseURL: ASAAS_API_URL,
  timeout: obterTimeoutAsaas(),

  headers: {
    "Content-Type":
      "application/json",

    "User-Agent":
      process.env.ASAAS_USER_AGENT ||
      "AgendaFashion/1.0",

    access_token:
      ASAAS_API_KEY
  }
});

const limparNumero =
  normalizarDocumento;

function adicionarSePreenchido(
  payload,
  campo,
  valor
) {
  const texto =
    String(valor || "").trim();

  if (texto) {
    payload[campo] = texto;
  }
}

function validarCpfCnpj(valor) {
  const documento =
    limparNumero(valor);

  if (!documentoValido(documento)) {
    throw new Error(
      "CPF/CNPJ inválido para criar o cliente no Asaas."
    );
  }

  return documento;
}

function separarValidade(validade) {
  const [mes, ano] =
    String(validade || "")
      .split("/");

  return {
    expiryMonth: mes,

    expiryYear:
      ano?.length === 2
        ? `20${ano}`
        : ano
  };
}

async function criarClienteAsaas({
  nome,
  email,
  telefone,
  cpfCnpj,
  externalReference,
  reutilizarPorExternalReference =
    false
}) {
  validarConfigAsaas();

  const nomeLimpo =
    String(nome || "").trim();

  if (!nomeLimpo) {
    throw new Error(
      "Nome obrigatório para criar o cliente no Asaas."
    );
  }

  if (
    reutilizarPorExternalReference &&
    externalReference
  ) {
    const clienteExistente =
      await buscarClientePorReferencia(
        externalReference
      );

    if (clienteExistente) {
      return clienteExistente;
    }
  }

  const payload = {
    name: nomeLimpo,
    cpfCnpj: validarCpfCnpj(cpfCnpj)
  };

  adicionarSePreenchido(
    payload,
    "email",
    email
  );

  adicionarSePreenchido(
    payload,
    "mobilePhone",
    limparNumero(telefone)
  );

  adicionarSePreenchido(
    payload,
    "externalReference",
    externalReference
  );

  const response =
    await asaasApi.post(
      "/customers",
      payload
    );

  return response.data;
}

async function buscarClientePorReferencia(
  externalReference
) {
  validarConfigAsaas();

  const referencia = String(
    externalReference || ""
  ).trim();

  if (!referencia) {
    return null;
  }

  const response =
    await asaasApi.get(
      "/customers",
      {
        params: {
          externalReference:
            referencia,
          limit: 1,
          offset: 0
        }
      }
    );

  return (
    response.data?.data?.[0] ||
    null
  );
}

async function criarCobrancaPix({
  customerId,
  valor,
  descricao,
  externalReference,
  reutilizarPorExternalReference =
    false
}) {
  validarConfigAsaas();

  if (
    reutilizarPorExternalReference &&
    externalReference
  ) {
    const cobrancaExistente =
      await buscarCobrancaPorReferencia({
        externalReference,
        customerId
      });

    if (cobrancaExistente) {
      return cobrancaExistente;
    }
  }

  const response =
    await asaasApi.post(
      "/payments",
      {
        customer: customerId,
        billingType: "PIX",
        value: Number(valor),

        dueDate:
          new Date()
            .toISOString()
            .slice(0, 10),

        description: descricao,
        externalReference
      }
    );

  return response.data;
}

async function buscarCobrancaPorReferencia({
  externalReference,
  customerId
}) {
  validarConfigAsaas();

  const referencia = String(
    externalReference || ""
  ).trim();

  if (!referencia) {
    return null;
  }

  const params = {
    externalReference: referencia,
    limit: 1,
    offset: 0
  };

  if (customerId) {
    params.customer = customerId;
  }

  const response =
    await asaasApi.get(
      "/payments",
      {
        params
      }
    );

  return (
    response.data?.data?.[0] ||
    null
  );
}

async function buscarQrCodePix(
  paymentId,
  {
    maxTentativas = 6,
    intervaloMs = 1000
  } = {}
) {
  validarConfigAsaas();

  const totalTentativas = Math.max(
    1,
    Number(maxTentativas) || 1
  );

  for (
    let tentativa = 1;
    tentativa <= totalTentativas;
    tentativa += 1
  ) {
    try {
      const response =
        await asaasApi.get(
          `/payments/${paymentId}/pixQrCode`
        );

      return response.data;
    } catch (erro) {
      const status =
        erro?.response?.status;

      const erroTemporario =
        status === 400 ||
        status === 404 ||
        status === 409 ||
        status === 429 ||
        status >= 500;

      if (
        !erroTemporario ||
        tentativa === totalTentativas
      ) {
        throw erro;
      }

      await new Promise(
        (resolve) => {
          setTimeout(
            resolve,
            Math.max(
              0,
              Number(intervaloMs) || 0
            )
          );
        }
      );
    }
  }
}

async function criarAssinaturaAsaas({
  customerId,
  valor,
  descricao,
  formaPagamento,
  externalReference,
  cartao,
  proximaCobranca,
  reutilizarPorExternalReference =
    false
}) {
  validarConfigAsaas();

  const nextDueDate =
    String(
      proximaCobranca || ""
    ).trim() ||
    new Date()
      .toISOString()
      .slice(0, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      nextDueDate
    )
  ) {
    throw new Error(
      "Data da próxima cobrança inválida para criar a assinatura no Asaas."
    );
  }

  if (
    reutilizarPorExternalReference &&
    externalReference
  ) {
    const assinaturaExistente =
      await buscarAssinaturaPorReferencia({
        externalReference,
        customerId
      });

    if (assinaturaExistente) {
      return assinaturaExistente;
    }
  }

  const payload = {
    customer: customerId,

    billingType:
      formaPagamento === "pix"
        ? "PIX"
        : "CREDIT_CARD",

    value: Number(valor),
    nextDueDate,
    cycle: "MONTHLY",
    description: descricao,
    externalReference
  };

  if (
    formaPagamento === "cartao"
  ) {
    const validade =
      separarValidade(
        cartao.validade
      );

    payload.creditCard = {
      holderName:
        cartao.nome,

      number:
        limparNumero(
          cartao.numero
        ),

      expiryMonth:
        validade.expiryMonth,

      expiryYear:
        validade.expiryYear,

      ccv:
        limparNumero(
          cartao.cvv
        )
    };

    payload.creditCardHolderInfo = {
      name:
        cartao.nome,

      email:
        cartao.email ||
        "cliente@agendafashion.com.br",

      cpfCnpj:
        limparNumero(
          cartao.cpfCnpj ||
          "00000000000"
        ),

      postalCode:
        limparNumero(
          cartao.postalCode ||
          "00000000"
        ),

      addressNumber:
        cartao.addressNumber ||
        "0",

      phone:
        limparNumero(
          cartao.phone || ""
        )
    };
  }

  const response =
    await asaasApi.post(
      "/subscriptions",
      payload
    );

  return response.data;
}

async function buscarAssinaturaPorReferencia({
  externalReference,
  customerId
}) {
  validarConfigAsaas();

  const referencia = String(
    externalReference || ""
  ).trim();

  if (!referencia) {
    return null;
  }

  const params = {
    externalReference:
      referencia,
    limit: 1,
    offset: 0
  };

  if (customerId) {
    params.customer =
      customerId;
  }

  const response =
    await asaasApi.get(
      "/subscriptions",
      {
        params
      }
    );

  return (
    response.data?.data?.[0] ||
    null
  );
}

async function listarPagamentosAssinatura(
  subscriptionId
) {
  validarConfigAsaas();

  const response =
    await asaasApi.get(
      `/subscriptions/${subscriptionId}/payments`
    );

  return response.data;
}

async function atualizarClienteAsaas(
  customerId,
  dados = {}
) {
  validarConfigAsaas();

  if (!customerId) {
    throw new Error(
      "Cliente Asaas não informado."
    );
  }

  const payload = {};

  adicionarSePreenchido(
    payload,
    "name",
    dados.nome
  );

  adicionarSePreenchido(
    payload,
    "email",
    dados.email
  );

  adicionarSePreenchido(
    payload,
    "mobilePhone",
    limparNumero(
      dados.telefone
    )
  );

  if (dados.cpfCnpj) {
    payload.cpfCnpj =
      validarCpfCnpj(
        dados.cpfCnpj
      );
  }

  if (
    Object.keys(payload).length === 0
  ) {
    throw new Error(
      "Nenhum dado informado para atualizar o cliente Asaas."
    );
  }

  const response =
    await asaasApi.put(
      `/customers/${customerId}`,
      payload
    );

  return response.data;
}

async function buscarPagamentoAsaas(
  paymentId
) {
  validarConfigAsaas();

  const response =
    await asaasApi.get(
      `/payments/${paymentId}`
    );

  return response.data;
}

async function removerAssinaturaAsaas(
  subscriptionId
) {
  validarConfigAsaas();

  const id = String(
    subscriptionId || ""
  ).trim();

  if (!id) {
    throw new Error(
      "Assinatura Asaas não informada."
    );
  }

  try {
    const response =
      await asaasApi.delete(
        `/subscriptions/${encodeURIComponent(id)}`
      );

    return {
      removida: true,
      ja_removida: false,
      dados: response.data || null
    };
  } catch (erro) {
    /*
     * Se uma tentativa anterior removeu a assinatura
     * no Asaas, ainda precisamos sincronizar o banco.
     */
    if (erro?.response?.status === 404) {
      return {
        removida: true,
        ja_removida: true,
        dados: null
      };
    }

    throw erro;
  }
}

module.exports = {
  validarConfigAsaas,
  identificarAmbienteAsaas,
  obterTimeoutAsaas,
  criarClienteAsaas,
  buscarClientePorReferencia,
  criarCobrancaPix,
  buscarCobrancaPorReferencia,
  buscarQrCodePix,
  criarAssinaturaAsaas,
  buscarAssinaturaPorReferencia,
  listarPagamentosAssinatura,
  atualizarClienteAsaas,
  buscarPagamentoAsaas,
  removerAssinaturaAsaas
};
