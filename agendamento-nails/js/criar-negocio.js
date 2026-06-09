document.addEventListener("DOMContentLoaded", () => {
  const API_URL = "https://agenda-fashion-production.up.railway.app";

  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario"));

  const nomeNegocio = document.getElementById("nomeNegocio");
  const btnCriarNegocio = document.getElementById("btnCriarNegocio");
  const mensagem = document.getElementById("mensagemCriarNegocio");
  const linkVoltarEscolha = document.getElementById("linkVoltarEscolha");

  if (!token || !usuario || usuario.tipo !== "profissional") {
    window.location.href = "login-profissional.html";
    return;
  }

  function desativarBotao() {
    btnCriarNegocio.disabled = true;
    btnCriarNegocio.classList.add("btn-disabled");
  }

  function ativarBotao() {
    btnCriarNegocio.disabled = false;
    btnCriarNegocio.classList.remove("btn-disabled");
  }

  function mostrarMensagem(texto, cor = "#e63946") {
    mensagem.textContent = texto;
    mensagem.style.color = cor;
    mensagem.classList.remove("hidden");
  }

  function esconderMensagem() {
    mensagem.textContent = "";
    mensagem.classList.add("hidden");
  }

  function limparEstadoBotao() {
    btnCriarNegocio.classList.remove("btn-success", "btn-error");
  }

  function limparErros(...inputs) {
    inputs.forEach((input) => {
      input.classList.remove("input-error", "shake");
    });
  }

  function tremerInputs(...inputs) {
    inputs.forEach((input) => {
      input.classList.remove("shake");
      void input.offsetWidth;
      input.classList.add("input-error", "shake");
    });
  }

  function formularioValido() {
    return nomeNegocio.value.trim().length >= 3;
  }

  function validarFormulario() {
    esconderMensagem();
    limparErros(nomeNegocio);
    limparEstadoBotao();
    btnCriarNegocio.innerHTML = "Criar negócio";

    if (formularioValido()) {
      ativarBotao();
    } else {
      desativarBotao();
    }
  }

  nomeNegocio.addEventListener("input", validarFormulario);
  validarFormulario();

  btnCriarNegocio.addEventListener("click", async () => {
    esconderMensagem();
    limparErros(nomeNegocio);
    limparEstadoBotao();

    if (nomeNegocio.value.trim().length < 3) {
      tremerInputs(nomeNegocio);
      mostrarMensagem("Digite um nome de negócio válido.");
      return;
    }

    try {
      btnCriarNegocio.innerHTML = `<span class="spinner-emoji">⏳</span> Criando...`;
      btnCriarNegocio.disabled = true;
      btnCriarNegocio.classList.add("btn-disabled");

      const resposta = await fetch(`${API_URL}/criar-negocio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          nome: nomeNegocio.value.trim()
        })
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro || "Erro ao criar negócio.");
      }

      mostrarMensagem("Negócio criado com sucesso 💅", "#2f9e63");

      btnCriarNegocio.innerHTML = "✅ Sucesso";
      btnCriarNegocio.classList.remove("btn-disabled", "btn-error");
      btnCriarNegocio.classList.add("btn-success");

      setTimeout(() => {
        document.body.classList.add("page-exit");
        setTimeout(() => {
          window.location.href = "painel-profissional.html";
        }, 350);
      }, 700);

    } catch (erro) {
      console.error("Erro ao criar negócio:", erro);

      mostrarMensagem(erro.message || "Erro na conexão com o servidor.");
      tremerInputs(nomeNegocio);

      btnCriarNegocio.innerHTML = "❌ Erro";
      btnCriarNegocio.classList.remove("btn-disabled", "btn-success");
      btnCriarNegocio.classList.add("btn-error");

      setTimeout(() => {
        validarFormulario();
      }, 1400);
    }
  });

  linkVoltarEscolha.addEventListener("click", (e) => {
    e.preventDefault();
    document.body.classList.add("page-exit");
    setTimeout(() => {
      window.location.href = "escolher-negocio.html";
    }, 350);
  });
});