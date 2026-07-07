document.addEventListener("DOMContentLoaded", () => {
  const email = document.getElementById("email");
  const senha = document.getElementById("senha");

  const btn = document.getElementById("btnLoginCliente");
  const mensagem = document.getElementById("mensagemLogin");

  const toggleSenha = document.getElementById("toggleSenha");

  const STORAGE_EMAIL = "ultimoEmail";

  if (!email || !senha || !btn || !mensagem || !toggleSenha) {
    console.error("Elementos do login cliente não encontrados.");
    return;
  }

  // 🔥 PREFILL EMAIL
  const emailSalvo = localStorage.getItem(STORAGE_EMAIL);
  if (emailSalvo) {
    email.value = emailSalvo;
  }

  function desativarBotao() {
    btn.disabled = true;
    btn.classList.add("btn-disabled");
  }

  function ativarBotao() {
    btn.disabled = false;
    btn.classList.remove("btn-disabled");
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
    btn.classList.remove("btn-success", "btn-error");
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

  function validarEmail(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
  }

  function formularioValido() {
    return (
      validarEmail(email.value) &&
      senha.value.trim().length >= 6
    );
  }

  function validarFormulario() {
    esconderMensagem();
    limparErros(email, senha);
    limparEstadoBotao();

    btn.innerHTML = "Entrar";

    if (formularioValido()) {
      ativarBotao();
    } else {
      desativarBotao();
    }
  }

  // 🔥 ENTER PARA LOGAR
  function handleEnter(e) {
    if (e.key === "Enter" && !btn.disabled) {
      btn.click();
    }
  }

  email.addEventListener("keydown", handleEnter);
  senha.addEventListener("keydown", handleEnter);

  // toggle senha
  toggleSenha.addEventListener("click", () => {
    if (senha.type === "password") {
      senha.type = "text";
      toggleSenha.textContent = "🙉";
    } else {
      senha.type = "password";
      toggleSenha.textContent = "🙈";
    }
  });

  // eventos
  email.addEventListener("input", validarFormulario);
  senha.addEventListener("input", validarFormulario);

  validarFormulario();

  // 🚀 login
  btn.addEventListener("click", async () => {
    esconderMensagem();
    limparErros(email, senha);
    limparEstadoBotao();

    if (!validarEmail(email.value)) {
      tremerInputs(email);
      mostrarMensagem("Digite um e-mail válido.");
      return;
    }

    if (senha.value.trim().length < 6) {
      tremerInputs(senha);
      mostrarMensagem("Senha inválida.");
      return;
    }

    try {
      btn.innerHTML = `<span class="spinner-emoji">⏳</span> Entrando...`;
      btn.disabled = true;
      btn.classList.add("btn-disabled");

      const resposta = await fetch(`${API_URL}/login`, {  
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email.value.trim(),
          senha: senha.value
        })
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro || "Erro ao fazer login.");
      }

      if (resultado.usuario?.tipo !== "cliente") {
        throw new Error("Acesso permitido apenas para clientes.");
      }

      // 🔥 SALVA EMAIL
      localStorage.setItem(STORAGE_EMAIL, email.value.trim());

      localStorage.setItem("token", resultado.token);
      localStorage.setItem("usuario", JSON.stringify(resultado.usuario));

      mostrarMensagem("Login realizado com sucesso 💅", "#2f9e63");

      btn.innerHTML = "✅ Sucesso";
      btn.classList.remove("btn-disabled", "btn-error");
      btn.classList.add("btn-success");

      const agendamentoPendente = localStorage.getItem("agendamentoPendente");

      setTimeout(() => {
        if (agendamentoPendente) {
          window.location.href = "/html/finalizar-agendamento.html";
        } else {
          window.location.href = "/html/inicio.html";
        }
      }, 700);

    } catch (erro) {
      mostrarMensagem(erro.message || "Erro na conexão com o servidor.");
      tremerInputs(email, senha);

      btn.innerHTML = "❌ Erro";
      btn.classList.remove("btn-disabled", "btn-success");
      btn.classList.add("btn-error");

      setTimeout(() => {
        validarFormulario();
      }, 1400);
    }
  });
});