function erroConfiguracao(mensagem) {
  const erro = new Error(mensagem);
  erro.code = "EMAIL_CONFIGURATION_ERROR";
  return erro;
}

function obterConfiguracao() {
  const habilitado =
    String(process.env.PASSWORD_RESET_EMAIL_ENABLED || "")
      .trim()
      .toLowerCase() === "true";
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const remetente = String(process.env.PASSWORD_RESET_EMAIL_FROM || "").trim();

  if (!habilitado) {
    throw erroConfiguracao("Envio de recuperação de senha desativado.");
  }

  if (!apiKey || !remetente) {
    throw erroConfiguracao("Configuração de e-mail de recuperação incompleta.");
  }

  return { apiKey, remetente };
}

function escaparHtml(valor) {
  return String(valor || "").replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[caractere]);
}

async function enviarRedefinicaoSenha({
  destinatario,
  nome,
  link,
}) {
  const { apiKey, remetente } = obterConfiguracao();
  const primeiroNome = String(nome || "").trim().split(/\s+/)[0] || "Olá";
  const nomeHtml = escaparHtml(primeiroNome);
  const linkHtml = escaparHtml(link);

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: remetente,
      to: [destinatario],
      subject: "Redefina sua senha do Agenda Fashion",
      text:
        `${primeiroNome}, recebemos uma solicitação para redefinir sua senha. ` +
        `Use este link nos próximos 30 minutos: ${link} ` +
        "Se você não fez essa solicitação, ignore esta mensagem.",
      html:
        `<p>Olá, ${nomeHtml}.</p>` +
        "<p>Recebemos uma solicitação para redefinir sua senha do Agenda Fashion.</p>" +
        `<p><a href="${linkHtml}">Criar uma nova senha</a></p>` +
        "<p>Este link expira em 30 minutos e só pode ser usado uma vez.</p>" +
        "<p>Se você não fez essa solicitação, ignore esta mensagem.</p>",
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!resposta.ok) {
    const erro = new Error("O provedor de e-mail recusou a mensagem.");
    erro.code = "EMAIL_PROVIDER_ERROR";
    erro.status = resposta.status;
    throw erro;
  }

  return resposta.json();
}

module.exports = {
  enviarRedefinicaoSenha,
};
