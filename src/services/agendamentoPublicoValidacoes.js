const ANTECEDENCIA_CANCELAMENTO_PADRAO = 24;

function criarErro(
  mensagem,
  statusCode
) {
  const erro =
    new Error(mensagem);

  erro.status =
    statusCode;

  erro.statusCode =
    statusCode;

  return erro;
}

function normalizarId(
  valor
) {
  const id =
    Number(valor);

  return (
    Number.isInteger(id) &&
    id > 0
  )
    ? id
    : null;
}

function normalizarTexto(
  valor,
  limite = 255
) {
  const texto =
    String(valor ?? "")
      .trim()
      .replace(/\s+/g, " ");

  return texto.slice(
    0,
    limite
  );
}

function normalizarWhatsapp(
  valor
) {
  let numeros =
    String(valor ?? "")
      .replace(/\D/g, "");

  if (
    (
      numeros.length === 12 ||
      numeros.length === 13
    ) &&
    numeros.startsWith("55")
  ) {
    numeros =
      numeros.slice(2);
  }

  return numeros;
}

function normalizarHorario(
  horario
) {
  const valor =
    String(horario ?? "")
      .trim();

  const correspondencia =
    valor.match(
      /^(\d{1,2}):(\d{2})/
    );

  if (!correspondencia) {
    return null;
  }

  const hora =
    Number(
      correspondencia[1]
    );

  const minuto =
    Number(
      correspondencia[2]
    );

  if (
    !Number.isInteger(hora) ||
    !Number.isInteger(minuto) ||
    hora < 0 ||
    hora > 23 ||
    minuto < 0 ||
    minuto > 59
  ) {
    return null;
  }

  return (
    `${String(hora).padStart(
      2,
      "0"
    )}:` +
    String(minuto).padStart(
      2,
      "0"
    )
  );
}

function dataValida(
  data
) {
  const valor =
    String(data ?? "")
      .trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      valor
    )
  ) {
    return false;
  }

  const [
    ano,
    mes,
    dia,
  ] =
    valor
      .split("-")
      .map(Number);

  const dataUtc =
    new Date(
      Date.UTC(
        ano,
        mes - 1,
        dia
      )
    );

  return (
    dataUtc.getUTCFullYear() ===
      ano &&
    dataUtc.getUTCMonth() ===
      mes - 1 &&
    dataUtc.getUTCDate() ===
      dia
  );
}

function validarClienteAutenticado({
  clienteId,
}) {
  const id =
    normalizarId(
      clienteId
    );

  if (!id) {
    throw criarErro(
      "Usuário não autenticado.",
      401
    );
  }

  return id;
}

function validarIdentificacaoVisitante({
  clienteNome,
  clienteWhatsapp,
}) {
  const nome =
    normalizarTexto(
      clienteNome,
      120
    );

  const whatsapp =
    normalizarWhatsapp(
      clienteWhatsapp
    );

  if (nome.length < 2) {
    throw criarErro(
      "Informe o nome do cliente.",
      400
    );
  }

  if (
    ![10, 11].includes(
      whatsapp.length
    )
  ) {
    throw criarErro(
      "Informe um WhatsApp válido com DDD.",
      400
    );
  }

  return {
    clienteNome:
      nome,

    clienteWhatsapp:
      whatsapp,
  };
}

function converterDataHoraParaTimestamp({
  data,
  horario,
}) {
  const horarioNormalizado =
    normalizarHorario(
      horario
    );

  if (
    !dataValida(data) ||
    !horarioNormalizado
  ) {
    return null;
  }

  /*
   * Data e hora locais são comparadas
   * como valores nominais do fuso do negócio.
   */
  const timestamp =
    Date.parse(
      `${data}T` +
      `${horarioNormalizado}:00Z`
    );

  return Number.isNaN(
    timestamp
  )
    ? null
    : timestamp;
}

function normalizarAntecedenciaCancelamento(
  valor
) {
  const numero =
    Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero < 0
  ) {
    return (
      ANTECEDENCIA_CANCELAMENTO_PADRAO
    );
  }

  return Math.floor(
    numero
  );
}

function formatarQuantidadeHoras(
  quantidade
) {
  return quantidade === 1
    ? "1 hora"
    : `${quantidade} horas`;
}

module.exports = {
  ANTECEDENCIA_CANCELAMENTO_PADRAO,
  criarErro,
  normalizarId,
  normalizarTexto,
  normalizarWhatsapp,
  normalizarHorario,
  dataValida,
  validarClienteAutenticado,
  validarIdentificacaoVisitante,
  converterDataHoraParaTimestamp,
  normalizarAntecedenciaCancelamento,
  formatarQuantidadeHoras,
};
