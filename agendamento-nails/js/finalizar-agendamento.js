document.addEventListener("DOMContentLoaded", async () => {
  

  const mensagem = document.getElementById("mensagemFinalizar");

  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
  const agendamentoPendente = localStorage.getItem("agendamentoPendente");

  if (!token || !usuario || usuario.tipo !== "cliente") {
    window.location.href = "login-cliente.html";
    return;
  }

  if (!agendamentoPendente) {
    window.location.href = "inicio.html";
    return;
  }

  try {
    const dados = JSON.parse(agendamentoPendente);

    const resposta = await fetch(`${API_URL}/agendamentos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(dados)
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
      throw new Error(resultado.erro || "Erro ao finalizar agendamento.");
    }

    localStorage.removeItem("agendamentoPendente");
    localStorage.removeItem("voltarDepoisLogin");

    mensagem.textContent = "Agendamento confirmado com sucesso 💅";

    setTimeout(() => {
      window.location.href = "meus-agendamentos.html";
    }, 900);

  } catch (erro) {
    console.error("Erro ao finalizar agendamento:", erro);

    mensagem.textContent = erro.message || "Não foi possível finalizar o agendamento.";

    localStorage.removeItem("agendamentoPendente");

    setTimeout(() => {
      window.location.href = "inicio.html";
    }, 1800);
  }
});