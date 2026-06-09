document.addEventListener("DOMContentLoaded", () => {
  const API_URL = "http://localhost:3000";

  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
  const mensagem = document.getElementById("mensagemPagamento");
  const botoes = document.querySelectorAll(".btn-plano");

  if (!token || !usuario || usuario.tipo !== "profissional") {
    window.location.href = "login-profissional.html";
    return;
  }

  function mostrarMensagem(texto, cor = "#e63946") {
    mensagem.textContent = texto;
    mensagem.style.color = cor;
    mensagem.classList.remove("hidden");
  }

  async function ativarPlano(plano, botao) {
    try {
      botao.disabled = true;
      botao.textContent = "Ativando...";

      const res = await fetch(`${API_URL}/plano/ativar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plano })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || "Erro ao ativar plano.");
      }

      mostrarMensagem("Plano ativado com sucesso 💅", "#2f9e63");

      setTimeout(() => {
        window.location.href = "painel-profissional.html";
      }, 900);

    } catch (err) {
      mostrarMensagem(err.message || "Erro na conexão.");
      botao.disabled = false;
      botao.textContent = plano === "pro" ? "Assinar Pro" : "Assinar Business";
    }
  }

  botoes.forEach((botao) => {
    botao.addEventListener("click", () => {
      const plano = botao.dataset.plano;
      ativarPlano(plano, botao);
    });
  });
});