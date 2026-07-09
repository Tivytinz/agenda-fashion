async function novoAgendamento(agendamento) {
  console.log(`
==========================================
📲 NOVO AGENDAMENTO

Cliente: ${agendamento.cliente_nome}
Serviço: ${agendamento.servico}
Profissional: ${agendamento.profissional}
Data: ${agendamento.data}
Hora: ${agendamento.horario}
==========================================
`);
}

module.exports = {
  novoAgendamento
};