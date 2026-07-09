async function enviarMensagem(numero, mensagem) {
  console.log(`
==========================
📱 WHATSAPP

Para: ${numero || "número não informado"}

${mensagem}
==========================
`);
}

module.exports = {
  enviarMensagem,
};