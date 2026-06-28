const axios = require("axios");

const ASAAS_API_URL = process.env.ASAAS_API_URL;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

function validarConfigAsaas() {
  if (!ASAAS_API_URL || !ASAAS_API_KEY) {
    throw new Error("Configuração do Asaas ausente.");
  }
}

const asaasApi = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    "Content-Type": "application/json",
    access_token: ASAAS_API_KEY
  }
});

function limparNumero(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function separarValidade(validade) {
  const [mes, ano] = String(validade || "").split("/");

  return {
    expiryMonth: mes,
    expiryYear: ano?.length === 2 ? `20${ano}` : ano
  };
}

async function criarClienteAsaas({ nome, email, telefone }) {
  validarConfigAsaas();

  const response = await asaasApi.post("/customers", {
  name: nome,
  email,
  mobilePhone: limparNumero(telefone),
  cpfCnpj: "24971563792"
});

  return response.data;
}

async function criarCobrancaPix({ customerId, valor, descricao, externalReference }) {
  validarConfigAsaas();

  const response = await asaasApi.post("/payments", {
    customer: customerId,
    billingType: "PIX",
    value: Number(valor),
    dueDate: new Date().toISOString().slice(0, 10),
    description: descricao,
    externalReference
  });

  return response.data;
}

async function buscarQrCodePix(paymentId) {
  validarConfigAsaas();

  const response = await asaasApi.get(`/payments/${paymentId}/pixQrCode`);

  return response.data;
}

async function criarAssinaturaAsaas({
  customerId,
  valor,
  descricao,
  formaPagamento,
  externalReference,
  cartao
}) {
  validarConfigAsaas();

  const payload = {
    customer: customerId,
    billingType: formaPagamento === "pix" ? "PIX" : "CREDIT_CARD",
    value: Number(valor),
    nextDueDate: new Date().toISOString().slice(0, 10),
    cycle: "MONTHLY",
    description: descricao,
    externalReference
  };

  if (formaPagamento === "cartao") {
    const validade = separarValidade(cartao.validade);

    payload.creditCard = {
      holderName: cartao.nome,
      number: limparNumero(cartao.numero),
      expiryMonth: validade.expiryMonth,
      expiryYear: validade.expiryYear,
      ccv: limparNumero(cartao.cvv)
    };

    payload.creditCardHolderInfo = {
      name: cartao.nome,
      email: cartao.email || "cliente@agendafashion.com.br",
      cpfCnpj: limparNumero(cartao.cpfCnpj || "00000000000"),
      postalCode: limparNumero(cartao.postalCode || "00000000"),
      addressNumber: cartao.addressNumber || "0",
      phone: limparNumero(cartao.phone || "")
    };
  }

  const response = await asaasApi.post("/subscriptions", payload);

  return response.data;
}

async function listarPagamentosAssinatura(subscriptionId) {
  validarConfigAsaas();

  const response = await asaasApi.get(
    `/subscriptions/${subscriptionId}/payments`
  );

  return response.data;
}

async function atualizarClienteAsaas(customerId, dados = {}) {
  validarConfigAsaas();

  const response = await asaasApi.put(`/customers/${customerId}`, {
    cpfCnpj: dados.cpfCnpj || "24971563792"
  });

  return response.data;
}

async function buscarPagamentoAsaas(paymentId) {
  validarConfigAsaas();

  const response = await asaasApi.get(`/payments/${paymentId}`);

  return response.data;
}

module.exports = {
  criarClienteAsaas,
  criarCobrancaPix,
  buscarQrCodePix,
  criarAssinaturaAsaas,
  listarPagamentosAssinatura,
  atualizarClienteAsaas,
  buscarPagamentoAsaas
};