const whatsappProvider = require("../providers/whatsappProvider");

async function novoAgendamento(dados) {
  await whatsappProvider.enviarMensagem(
    dados.whatsapp,
    `
📅 Novo Agendamento

Cliente: ${dados.cliente}
Serviço: ${dados.servico}
Profissional: ${dados.profissional}
Data: ${dados.data}
Hora: ${dados.horario}
`
  );
}

module.exports = {
  novoAgendamento,
};