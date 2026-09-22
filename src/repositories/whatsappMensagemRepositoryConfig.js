const TIPOS_ATIVOS = [
  "NOVO_AGENDAMENTO_PROFISSIONAL",
  "CONFIRMACAO_AGENDAMENTO_CLIENTE",
  "REAGENDAMENTO_SEM_CANCELAMENTO_CLIENTE",
  "LEMBRETE_AGENDAMENTO_CLIENTE",
  "LEMBRETE_AGENDAMENTO_PROFISSIONAL",
];

const TIPOS_CANCELAMENTO = [
  "CANCELAMENTO_AGENDAMENTO_PROFISSIONAL",
  "CANCELAMENTO_AGENDAMENTO_CLIENTE",
];

const TIPOS_NEGOCIO = [
  "LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO",
  "LEMBRETE_DIVULGAR_NEGOCIO",
];

const TIPOS_CLIENTE = [
  "CONFIRMACAO_AGENDAMENTO_CLIENTE",
  "REAGENDAMENTO_SEM_CANCELAMENTO_CLIENTE",
  "LEMBRETE_AGENDAMENTO_CLIENTE",
  "CANCELAMENTO_AGENDAMENTO_CLIENTE",
];

const TIPOS_PROFISSIONAL = [
  "NOVO_AGENDAMENTO_PROFISSIONAL",
  "LEMBRETE_AGENDAMENTO_PROFISSIONAL",
  "CANCELAMENTO_AGENDAMENTO_PROFISSIONAL",
];

function validarExecutor(
  executor
) {
  if (
    !executor ||
    typeof executor.query !==
      "function"
  ) {
    throw new Error(
      "Executor de banco de dados inválido."
    );
  }
}

function normalizarTelefoneNacional(
  telefone
) {
  const normalizado =
    String(telefone || "")
      .replace(/\D/g, "")
      .replace(
        /^55(?=\d{10,11}$)/,
        ""
      );

  return /^[0-9]{10,11}$/.test(
    normalizado
  )
    ? normalizado
    : null;
}

module.exports = {
  TIPOS_ATIVOS,
  TIPOS_CANCELAMENTO,
  TIPOS_NEGOCIO,
  TIPOS_CLIENTE,
  TIPOS_PROFISSIONAL,
  validarExecutor,
  normalizarTelefoneNacional,
};
