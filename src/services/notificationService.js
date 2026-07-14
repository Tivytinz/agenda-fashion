const whatsappProvider = require(
  "../providers/whatsappProvider"
);

function valorSeguro(valor) {
  if (
    valor === null ||
    valor === undefined ||
    String(valor).trim() === ""
  ) {
    return "-";
  }

  return String(valor).trim();
}

function formatarData(data) {
  const partes = valorSeguro(data).split("-");

  if (
    partes.length !== 3 ||
    partes[0].length !== 4
  ) {
    return valorSeguro(data);
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarHorario(horario) {
  return valorSeguro(horario).slice(0, 5);
}

async function novoAgendamento(dados = {}) {
  return whatsappProvider.enviarNovoAgendamento(
    valorSeguro(dados.whatsapp),
    [
      valorSeguro(dados.cliente),
      valorSeguro(dados.servico),
      valorSeguro(dados.profissional),
      formatarData(dados.data),
      formatarHorario(dados.horario),
    ]
  );
}

async function agendamentoCancelado(
  dados = {}
) {
  /*
   * Quando o template
   * "agendamento_cancelado"
   * estiver aprovado,
   * basta trocar
   * enviarMensagem()
   * por enviarTemplate().
   */

  const mensagem =
`❌ Agendamento cancelado

Cliente: ${valorSeguro(dados.cliente)}

Serviço: ${valorSeguro(dados.servico)}

Data: ${formatarData(dados.data)}

Hora: ${formatarHorario(dados.horario)}

Este horário voltou a ficar disponível.`;

  return whatsappProvider.enviarMensagem(
    valorSeguro(dados.whatsapp),
    mensagem
  );
}

module.exports = {
  novoAgendamento,
  agendamentoCancelado,
};