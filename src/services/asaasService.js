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

async function criarClienteAsaas({ nome, email, telefone }) {
  validarConfigAsaas();

  const response = await asaasApi.post("/customers", {
    name: nome,
    email,
    mobilePhone: telefone
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
  externalReference
}) {
  validarConfigAsaas();

  const response = await asaasApi.post("/subscriptions", {
    customer: customerId,
    billingType: formaPagamento === "pix" ? "PIX" : "CREDIT_CARD",
    value: Number(valor),
    nextDueDate: new Date().toISOString().slice(0, 10),
    cycle: "MONTHLY",
    description: descricao,
    externalReference
  });

  return response.data;
}

async function listarPagamentosAssinatura(subscriptionId) {
  validarConfigAsaas();

  const response = await asaasApi.get(
    `/subscriptions/${subscriptionId}/payments`
  );

  return response.data;
}

module.exports = {
  criarClienteAsaas,
  criarCobrancaPix,
  buscarQrCodePix,
  criarAssinaturaAsaas,
  listarPagamentosAssinatura
};